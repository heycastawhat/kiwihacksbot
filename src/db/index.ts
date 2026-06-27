import Airtable from 'airtable';
import { config } from '../config';

const base = new Airtable({ apiKey: config.airtableApiKey }).base(config.airtableBaseId);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Submission {
  id: string; // Airtable record ID
  user_id: string;
  username: string;
  message_id: string;
  channel_id: string;
  project_name: string | null;
  description: string | null;
  address: string | null;
  month: number;
  year: number;
  submitted_at: string;
  status: string;
}

export interface VotingSession {
  id: string;
  month: number;
  year: number;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface VotingMessage {
  id: string;
  submission_id: string;
  message_id: string;
  session_id: string;
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function getSubmissionByUserAndMonth(
  userId: string,
  month: number,
  year: number,
): Promise<Submission | undefined> {
  const records = await base('submissions').select({
    filterByFormula: `AND({user_id} = '${userId}', {month} = ${month}, {year} = ${year}, {status} = 'active')`,
    maxRecords: 1
  }).firstPage();

  if (records.length === 0) return undefined;
  const r = records[0];
  return {
    id: r.id,
    user_id: r.get('user_id') as string,
    username: r.get('username') as string,
    message_id: r.get('message_id') as string,
    channel_id: r.get('channel_id') as string,
    project_name: r.get('project_name') as string,
    description: r.get('description') as string,
    address: (r.get('address') as string) || null,
    month: r.get('month') as number,
    year: r.get('year') as number,
    submitted_at: r.get('submitted_at') as string,
    status: r.get('status') as string,
  };
}

export async function getPendingSubmission(userId: string): Promise<Submission | undefined> {
  const records = await base('submissions').select({
    filterByFormula: `AND({user_id} = '${userId}', {status} = 'pending')`,
    maxRecords: 1
  }).firstPage();

  if (records.length === 0) return undefined;
  const r = records[0];
  return {
    id: r.id,
    user_id: r.get('user_id') as string,
  } as Submission;
}

export async function createSubmission(
  userId: string,
  username: string,
  messageId: string,
  channelId: string,
  month: number,
  year: number,
): Promise<string> {
  const records = await base('submissions').create([
    {
      fields: {
        user_id: userId,
        username,
        message_id: messageId,
        channel_id: channelId,
        month,
        year,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      }
    }
  ]);
  return records[0].id;
}

export async function completeSubmission(
  id: string,
  projectName: string,
  description: string,
  address: string,
): Promise<void> {
  await base('submissions').update([
    {
      id,
      fields: {
        project_name: projectName,
        description: description,
        address: address,
        status: 'active'
      }
    }
  ]);
}

export async function cancelPendingSubmission(id: string): Promise<void> {
  await base('submissions').destroy([id]);
}

export async function getActiveSubmissions(month: number, year: number): Promise<Submission[]> {
  const records = await base('submissions').select({
    filterByFormula: `AND({month} = ${month}, {year} = ${year}, {status} = 'active')`
  }).all();

  return records.map(r => ({
    id: r.id,
    user_id: r.get('user_id') as string,
    username: r.get('username') as string,
    message_id: r.get('message_id') as string,
    channel_id: r.get('channel_id') as string,
    project_name: r.get('project_name') as string,
    description: r.get('description') as string,
    address: (r.get('address') as string) || null,
    month: r.get('month') as number,
    year: r.get('year') as number,
    submitted_at: r.get('submitted_at') as string,
    status: r.get('status') as string,
  }));
}

export async function getTopSubmissions(
  month: number,
  year: number,
  limit = 10,
): Promise<(Submission & { vote_count: number })[]> {
  const submissions = await getActiveSubmissions(month, year);
  const result = [];
  
  for (const sub of submissions) {
    const vote_count = await getVoteCount(sub.id);
    result.push({ ...sub, vote_count });
  }

  return result.sort((a, b) => b.vote_count - a.vote_count).slice(0, limit);
}

// ─── Votes ────────────────────────────────────────────────────────────────────

export async function getVoteCount(submissionId: string): Promise<number> {
  const records = await base('votes').select({
    filterByFormula: `{submission_id} = '${submissionId}'`
  }).all();
  return records.length;
}

export async function hasVoted(voterId: string, submissionId: string): Promise<boolean> {
  const records = await base('votes').select({
    filterByFormula: `AND({voter_id} = '${voterId}', {submission_id} = '${submissionId}')`,
    maxRecords: 1
  }).firstPage();
  return records.length > 0;
}

export async function addVote(voterId: string, submissionId: string): Promise<void> {
  const voted = await hasVoted(voterId, submissionId);
  if (!voted) {
    await base('votes').create([
      {
        fields: {
          voter_id: voterId,
          submission_id: submissionId,
          voted_at: new Date().toISOString()
        }
      }
    ]);
  }
}

export async function removeVote(voterId: string, submissionId: string): Promise<void> {
  const records = await base('votes').select({
    filterByFormula: `AND({voter_id} = '${voterId}', {submission_id} = '${submissionId}')`,
    maxRecords: 1
  }).firstPage();
  
  if (records.length > 0) {
    await base('votes').destroy([records[0].id]);
  }
}

// ─── Voting Sessions ──────────────────────────────────────────────────────────

export async function getActiveVotingSession(): Promise<VotingSession | undefined> {
  const records = await base('voting_sessions').select({
    filterByFormula: `{status} = 'active'`,
    maxRecords: 1
  }).firstPage();

  if (records.length === 0) return undefined;
  const r = records[0];
  return {
    id: r.id,
    month: r.get('month') as number,
    year: r.get('year') as number,
    status: r.get('status') as string,
    started_at: r.get('started_at') as string,
    ended_at: r.get('ended_at') as string | null,
  };
}

export async function createVotingSession(month: number, year: number): Promise<string> {
  const records = await base('voting_sessions').create([
    {
      fields: {
        month,
        year,
        status: 'active',
        started_at: new Date().toISOString()
      }
    }
  ]);
  return records[0].id;
}

export async function closeVotingSession(sessionId: string): Promise<void> {
  await base('voting_sessions').update([
    {
      id: sessionId,
      fields: {
        status: 'closed',
        ended_at: new Date().toISOString()
      }
    }
  ]);
}

// ─── Voting Messages ──────────────────────────────────────────────────────────

export async function createVotingMessage(
  submissionId: string,
  messageId: string,
  sessionId: string,
): Promise<void> {
  await base('voting_messages').create([
    {
      fields: {
        submission_id: submissionId,
        message_id: messageId,
        session_id: sessionId
      }
    }
  ]);
}

export async function getVotingMessageBySubmission(
  submissionId: string,
  sessionId: string,
): Promise<VotingMessage | undefined> {
  const records = await base('voting_messages').select({
    filterByFormula: `AND({submission_id} = '${submissionId}', {session_id} = '${sessionId}')`,
    maxRecords: 1
  }).firstPage();

  if (records.length === 0) return undefined;
  const r = records[0];
  return {
    id: r.id,
    submission_id: r.get('submission_id') as string,
    message_id: r.get('message_id') as string,
    session_id: r.get('session_id') as string,
  };
}
