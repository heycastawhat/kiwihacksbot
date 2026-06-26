import 'dotenv/config';

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required in .env');
if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is required in .env');

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,

  // Submission server
  submissionGuildId: '1364843430622134282',
  submissionChannelId: '1500026751219404921',

  // Ops server (results go here)
  opsGuildId: '1512948988817444874',
  opsChannelId: '1520190698928865321',

  // The emoji users react with to trigger submission
  submissionEmoji: '⭐',

  // All channels where a ⭐ reaction triggers the submission flow
  // (ops channel included for testing)
  get validSubmissionChannels() {
    return [this.submissionChannelId, this.opsChannelId];
  },
};
