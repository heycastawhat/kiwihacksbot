import {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';
import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { Submission } from '../db';
import {
  getSubmissionByMessageId,
  getActiveSubmissions,
  getVoters,
  addVote,
  removeVote,
} from '../db';

type Reaction = MessageReaction | PartialMessageReaction;
type ReactingUser = User | PartialUser;

// Resolves a reaction event to the active submission it votes on, or null if it isn't a vote.
async function resolveVote(reaction: Reaction, user: ReactingUser): Promise<Submission | null> {
  // Reactions on older/uncached messages arrive partial
  if (reaction.partial) {
    try { await reaction.fetch(); }
    catch (e) { console.log('[reaction] fetch failed:', e); return null; }
  }
  if (user.partial) {
    try { await user.fetch(); }
    catch (e) { console.log('[reaction] user fetch failed:', e); return null; }
  }

  if (user.bot) return null;
  if (reaction.emoji.name !== config.voteEmoji) return null;

  const sub = await getSubmissionByMessageId(reaction.message.id);
  if (!sub || sub.status !== 'active') return null;
  return sub;
}

export async function handleMessageReactionAdd(
  reaction: Reaction,
  user: ReactingUser,
): Promise<void> {
  const sub = await resolveVote(reaction, user);
  if (!sub) return;

  if (sub.user_id === user.id) {
    try {
      await reaction.users.remove(user.id);
    } catch (e) {
      console.log('[reaction] failed to remove self-vote:', e);
    }
    try {
      const dm = await user.createDM();
      await dm.send('You cannot vote for your own project!');
    } catch (e) {}
    return;
  }

  await addVote(user.id, sub.id);
}

export async function handleMessageReactionRemove(
  reaction: Reaction,
  user: ReactingUser,
): Promise<void> {
  const sub = await resolveVote(reaction, user);
  if (!sub) return;

  await removeVote(user.id, sub.id);
}

/**
 * Discord doesn't replay reaction events for time the bot was offline, so a restart can leave
 * stars on posts with no matching vote (or votes with no star). Re-syncs both directions.
 */
export async function reconcileVotes(client: Client): Promise<void> {
  let added = 0;
  let removed = 0;

  for (const sub of await getActiveSubmissions()) {
    try {
      const channel = (await client.channels.fetch(sub.channel_id)) as TextChannel;
      const message = await channel.messages.fetch(sub.message_id);
      const reaction = message.reactions.cache.find((r) => r.emoji.name === config.voteEmoji);

      const onPost = new Set<string>();
      if (reaction) {
        const users = await reaction.users.fetch();
        users.forEach((u) => {
          if (!u.bot && u.id !== sub.user_id) onPost.add(u.id);
        });
      }

      const recorded = new Set(await getVoters(sub.id));
      for (const id of onPost) {
        if (!recorded.has(id)) { await addVote(id, sub.id); added++; }
      }
      for (const id of recorded) {
        if (!onPost.has(id)) { await removeVote(id, sub.id); removed++; }
      }
    } catch (e) {
      console.log(`[reconcile] skipped ${sub.message_id}:`, e);
    }
  }

  if (added || removed) {
    console.log(`[reconcile] synced votes to reactions: +${added} -${removed}`);
  }
}

// A moderator clearing reactions wipes the visible count; drop the votes so the two agree.
export async function handleReactionsCleared(message: { id: string }): Promise<void> {
  const sub = await getSubmissionByMessageId(message.id);
  if (!sub || sub.status !== 'active') return;

  for (const voterId of await getVoters(sub.id)) {
    await removeVote(voterId, sub.id);
  }
  console.log(`[reaction] cleared all votes for submission ${sub.id}`);
}
