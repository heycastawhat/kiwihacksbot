import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const db = new DatabaseSync(path.join(process.cwd(), 'data.db'));

// Performance & integrity settings
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    NOT NULL,
    username     TEXT    NOT NULL,
    message_id   TEXT    NOT NULL,
    channel_id   TEXT    NOT NULL,
    project_name TEXT,
    description  TEXT,
    month        INTEGER NOT NULL,
    year         INTEGER NOT NULL,
    submitted_at TEXT    NOT NULL DEFAULT (datetime('now')),
    status       TEXT    NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS votes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id      TEXT    NOT NULL,
    submission_id INTEGER NOT NULL,
    voted_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(voter_id, submission_id),
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS voting_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    month      INTEGER NOT NULL,
    year       INTEGER NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'active',
    started_at TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS voting_messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    message_id    TEXT    NOT NULL,
    session_id    INTEGER NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id)    REFERENCES voting_sessions(id) ON DELETE CASCADE
  );
`);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Submission {
  id: number;
  user_id: string;
  username: string;
  message_id: string;
  channel_id: string;
  project_name: string | null;
  description: string | null;
  month: number;
  year: number;
  submitted_at: string;
  status: string;
}

export interface VotingSession {
  id: number;
  month: number;
  year: number;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface VotingMessage {
  id: number;
  submission_id: number;
  message_id: string;
  session_id: number;
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export function getSubmissionByUserAndMonth(
  userId: string,
  month: number,
  year: number,
): Submission | undefined {
  return db
    .prepare(
      `SELECT * FROM submissions
       WHERE user_id = ? AND month = ? AND year = ? AND status = 'active'`,
    )
    .get(userId, month, year) as Submission | undefined;
}

export function getPendingSubmission(userId: string): Submission | undefined {
  return db
    .prepare(`SELECT * FROM submissions WHERE user_id = ? AND status = 'pending'`)
    .get(userId) as Submission | undefined;
}

export function createSubmission(
  userId: string,
  username: string,
  messageId: string,
  channelId: string,
  month: number,
  year: number,
): number {
  const result = db
    .prepare(
      `INSERT INTO submissions (user_id, username, message_id, channel_id, month, year, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(userId, username, messageId, channelId, month, year);
  return Number(result.lastInsertRowid);
}

export function completeSubmission(
  id: number,
  projectName: string,
  description: string,
): void {
  db.prepare(
    `UPDATE submissions SET project_name = ?, description = ?, status = 'active' WHERE id = ?`,
  ).run(projectName, description, id);
}

export function cancelPendingSubmission(id: number): void {
  db.prepare(`DELETE FROM submissions WHERE id = ? AND status = 'pending'`).run(id);
}

export function getActiveSubmissions(month: number, year: number): Submission[] {
  return db
    .prepare(
      `SELECT * FROM submissions WHERE month = ? AND year = ? AND status = 'active' ORDER BY id ASC`,
    )
    .all(month, year) as unknown as Submission[];
}

export function getTopSubmissions(
  month: number,
  year: number,
  limit = 10,
): (Submission & { vote_count: number })[] {
  return db
    .prepare(
      `SELECT s.*, COUNT(v.id) AS vote_count
       FROM submissions s
       LEFT JOIN votes v ON s.id = v.submission_id
       WHERE s.month = ? AND s.year = ? AND s.status = 'active'
       GROUP BY s.id
       ORDER BY vote_count DESC, s.id ASC
       LIMIT ?`,
    )
    .all(month, year, limit) as unknown as (Submission & { vote_count: number })[];
}

// ─── Votes ────────────────────────────────────────────────────────────────────

export function getVoteCount(submissionId: number): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM votes WHERE submission_id = ?`)
    .get(submissionId) as { count: number };
  return Number(row.count);
}

export function hasVoted(voterId: string, submissionId: number): boolean {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM votes WHERE voter_id = ? AND submission_id = ?`)
    .get(voterId, submissionId) as { count: number };
  return Number(row.count) > 0;
}

export function addVote(voterId: string, submissionId: number): void {
  db.prepare(`INSERT OR IGNORE INTO votes (voter_id, submission_id) VALUES (?, ?)`).run(
    voterId,
    submissionId,
  );
}

export function removeVote(voterId: string, submissionId: number): void {
  db.prepare(`DELETE FROM votes WHERE voter_id = ? AND submission_id = ?`).run(
    voterId,
    submissionId,
  );
}

// ─── Voting Sessions ──────────────────────────────────────────────────────────

export function getActiveVotingSession(): VotingSession | undefined {
  return db
    .prepare(`SELECT * FROM voting_sessions WHERE status = 'active' LIMIT 1`)
    .get() as VotingSession | undefined;
}

export function createVotingSession(month: number, year: number): number {
  const result = db
    .prepare(`INSERT INTO voting_sessions (month, year) VALUES (?, ?)`)
    .run(month, year);
  return Number(result.lastInsertRowid);
}

export function closeVotingSession(sessionId: number): void {
  db.prepare(
    `UPDATE voting_sessions SET status = 'closed', ended_at = datetime('now') WHERE id = ?`,
  ).run(sessionId);
}

// ─── Voting Messages ──────────────────────────────────────────────────────────

export function createVotingMessage(
  submissionId: number,
  messageId: string,
  sessionId: number,
): void {
  db.prepare(
    `INSERT INTO voting_messages (submission_id, message_id, session_id) VALUES (?, ?, ?)`,
  ).run(submissionId, messageId, sessionId);
}

export function getVotingMessageBySubmission(
  submissionId: number,
  sessionId: number,
): VotingMessage | undefined {
  return db
    .prepare(
      `SELECT * FROM voting_messages WHERE submission_id = ? AND session_id = ?`,
    )
    .get(submissionId, sessionId) as VotingMessage | undefined;
}

export default db;
