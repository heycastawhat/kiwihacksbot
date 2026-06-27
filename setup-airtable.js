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
  await createTable('submissions', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'user_id', type: 'singleLineText' },
    { name: 'username', type: 'singleLineText' },
    { name: 'message_id', type: 'singleLineText' },
    { name: 'channel_id', type: 'singleLineText' },
    { name: 'project_name', type: 'singleLineText' },
    { name: 'description', type: 'multilineText' },
    { name: 'month', type: 'number', options: { precision: 0 } },
    { name: 'year', type: 'number', options: { precision: 0 } },
    { name: 'submitted_at', type: 'singleLineText' },
    { name: 'status', type: 'singleLineText' }
  ]);

  await createTable('votes', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'voter_id', type: 'singleLineText' },
    { name: 'submission_id', type: 'singleLineText' },
    { name: 'voted_at', type: 'singleLineText' }
  ]);

  await createTable('voting_sessions', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'month', type: 'number', options: { precision: 0 } },
    { name: 'year', type: 'number', options: { precision: 0 } },
    { name: 'status', type: 'singleLineText' },
    { name: 'started_at', type: 'singleLineText' },
    { name: 'ended_at', type: 'singleLineText' }
  ]);

  await createTable('voting_messages', [
    { name: 'Name', type: 'singleLineText' }, // Primary field
    { name: 'submission_id', type: 'singleLineText' },
    { name: 'message_id', type: 'singleLineText' },
    { name: 'session_id', type: 'singleLineText' }
  ]);
}

run();
