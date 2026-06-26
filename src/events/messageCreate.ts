import { Message, DMChannel } from 'discord.js';
import { completeSubmission, cancelPendingSubmission } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DMFlowState {
  submissionId: number;
  step: 'name' | 'description';
  projectName?: string;
  /** setTimeout handle used to cancel the flow if the user goes idle */
  timeoutHandle: ReturnType<typeof setTimeout>;
}

/** Keyed by Discord user ID */
export const pendingDMFlows = new Map<string, DMFlowState>();

const DM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMessageCreate(message: Message): Promise<void> {
  // Only care about DMs from real users
  if (message.guild) return;
  if (message.author.bot) return;

  const flow = pendingDMFlows.get(message.author.id);
  if (!flow) return;

  // Reset inactivity timeout on every message
  clearTimeout(flow.timeoutHandle);

  const text = message.content.trim();

  // ── Step 1: collect project name ──────────────────────────────────────────
  if (flow.step === 'name') {
    if (!text || text.length > 100) {
      flow.timeoutHandle = scheduleTimeout(message.author.id, flow.submissionId);
      await (message.channel as DMChannel).send(
        '❌ Project name must be 1–100 characters. Give it another go:',
      );
      return;
    }

    flow.projectName = text;
    flow.step = 'description';
    flow.timeoutHandle = scheduleTimeout(message.author.id, flow.submissionId);

    await (message.channel as DMChannel).send({
      embeds: [
        {
          color: 0x5865f2,
          title: `✅ Got it — "${text}"`,
          description:
            '**Now describe your project in one sentence.**\n*(Max 280 characters)*',
          footer: { text: 'Keep it punchy!' },
        },
      ],
    });
    return;
  }

  // ── Step 2: collect description ───────────────────────────────────────────
  if (flow.step === 'description') {
    if (!text || text.length > 280) {
      flow.timeoutHandle = scheduleTimeout(message.author.id, flow.submissionId);
      await (message.channel as DMChannel).send(
        '❌ Description must be 1–280 characters. Try again:',
      );
      return;
    }

    const projectName = flow.projectName!;

    // Persist to DB
    completeSubmission(flow.submissionId, projectName, text);
    pendingDMFlows.delete(message.author.id);

    await (message.channel as DMChannel).send({
      embeds: [
        {
          color: 0x57f287,
          title: '🎉 Submission received!',
          fields: [
            { name: '📌 Project', value: projectName, inline: false },
            { name: '📝 Description', value: text, inline: false },
          ],
          description:
            "You're in! Voting opens at the end of the month — good luck! 🤞",
          footer: { text: 'KiwiHacks Project Board' },
        },
      ],
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Starts a 5-minute inactivity timer. If the user doesn't respond in time,
 * the pending submission is cancelled and removed from memory.
 */
function scheduleTimeout(userId: string, submissionId: number) {
  return setTimeout(async () => {
    pendingDMFlows.delete(userId);
    cancelPendingSubmission(submissionId);
    // We can't easily DM here without a client ref — the timeout is best-effort.
    // The next ⭐ reaction will create a fresh flow.
    console.log(`[DM flow] Timed out for user ${userId}, submission ${submissionId} cancelled.`);
  }, DM_TIMEOUT_MS);
}

/** Public helper: starts a fresh DM flow timeout when the flow is first created */
export function startDMFlowTimeout(userId: string, submissionId: number) {
  return scheduleTimeout(userId, submissionId);
}
