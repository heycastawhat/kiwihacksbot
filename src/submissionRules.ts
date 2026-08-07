import { Message } from 'discord.js';

const LINK_RE = /https?:\/\/\S+/i;

/** Server nickname, falling back to global display name, then the raw username. */
export function displayNameOf(message: Message): string {
  return message.member?.displayName ?? message.author.displayName ?? message.author.username;
}

/**
 * Entry requirements for a #ship post. The image check matches what endvoting pulls into the
 * results embed, so anything that passes is guaranteed to render with a screenshot.
 */
export function missingRequirements(message: Message): string[] {
  const missing: string[] = [];
  if (!message.attachments.some((a) => a.contentType?.startsWith('image/'))) {
    missing.push('an image or screenshot attached');
  }
  if (!LINK_RE.test(message.content)) {
    missing.push('at least one link');
  }
  return missing;
}
