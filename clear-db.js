const Airtable = require('airtable');
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

async function clearTable(tableName) {
  try {
    const records = await base(tableName).select().all();
    const ids = records.map(r => r.id);
    
    if (ids.length === 0) {
      console.log(`Table ${tableName} is already empty.`);
      return;
    }
    
    // Airtable batch delete limit is 10 records per request
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await base(tableName).destroy(batch);
      console.log(`Deleted ${batch.length} records from ${tableName}.`);
    }
  } catch (err) {
    console.error(`Error clearing ${tableName}:`, err);
  }
}

async function run() {
  console.log('Clearing database...');
  await clearTable('votes');
  await clearTable('submissions');
  await clearTable('voting_sessions');
  console.log('Database cleared!');
}

run();
