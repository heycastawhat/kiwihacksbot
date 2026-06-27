const fs = require('fs');
const Airtable = require('airtable');
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

async function run() {
  try {
    await base('submissions').create([
      {
        fields: {
          user_id: '749120041441689600',
          username: 'micheal.wave',
          message_id: '1520247928885874869',
          channel_id: '1520190698928865321',
          project_name: 'Bald',
          description: 'eee',
          month: 6,
          year: 2026,
          status: 'active',
          submitted_at: '2026-06-27 02:02:34'
        }
      },
      {
        fields: {
          user_id: '696576641752760383',
          username: '.your_nemesis24.',
          message_id: '1520247937857359934',
          channel_id: '1520190698928865321',
          project_name: 'Test Project 2',
          description: 'This is the second test project',
          month: 6,
          year: 2026,
          status: 'active',
          submitted_at: '2026-06-27 02:02:38'
        }
      }
    ]);
    console.log('Test projects migrated successfully.');
  } catch (err) {
    console.log('Error creating test projects:', err.message);
  }
}
run();
