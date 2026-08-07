// Ensure you have airtable API key available
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

async function createTable(name, fields) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      fields,
      description: `Table for ${name}`
    })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error(`Error creating ${name}:`, data);
  } else {
    console.log(`Created table ${name}`);
  }
}

async function run() {
  await createTable('standup_days', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'date', type: 'singleLineText' }, // YYYY-MM-DD, local to config.standupTimezone
    { name: 'channel_id', type: 'singleLineText' },
    { name: 'thread_id', type: 'singleLineText' },
    { name: 'posted_at', type: 'singleLineText' },
    { name: 'ended_at', type: 'singleLineText' }
  ]);

  await createTable('standup_responses', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'thread_id', type: 'singleLineText' },
    { name: 'user_id', type: 'singleLineText' },
    { name: 'responded_at', type: 'singleLineText' }
  ]);
}

run();
