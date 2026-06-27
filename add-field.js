const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

async function run() {
  const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const schema = await schemaRes.json();
  const tableId = schema.tables.find(t => t.name === 'submissions').id;

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'address',
      type: 'multilineText'
    })
  });
  
  const data = await response.json();
  if (response.ok) {
    console.log('Added address field:', data);
  } else {
    console.error('Error adding field:', data);
  }
}

run();
