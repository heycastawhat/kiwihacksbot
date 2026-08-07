import 'dotenv/config';

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required in .env');
if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is required in .env');

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,

  airtableApiKey: process.env.AIRTABLE_API_KEY as string,
  airtableBaseId: process.env.AIRTABLE_BASE_ID as string,

  // Submission server
  submissionGuildId: '1364843430622134282',
  submissionChannelId: '1520268209977036920',

  // Ops server (results go here)
  opsGuildId: '1512948988817444874',
  opsChannelId: '1520190698928865321',

  // Emoji used to cast an anytime vote on a confirmed #ship post
  voteEmoji: '⭐',

  // Standup channel: daily prompt thread + bumps every 2 hours until everyone's replied
  standupChannelId: '1512967046411845642',
  standupTimezone: 'Pacific/Auckland',
  standupHour: 8, // 24h local time (standupTimezone) for the daily prompt

  // Members excluded from standup pings/bumps entirely
  standupExcludedUserIds: ['483921161340846081', '1482632634025771140', '614908394565926979'], // Lucy

  // Fillout form DMed to users once they confirm a #ship post
  filloutFormUrl: 'https://kiwihacks.fillout.com/community-stickers',
};
