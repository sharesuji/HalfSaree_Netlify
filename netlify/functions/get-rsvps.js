const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const password = (process.env.ADMIN_PASSWORD || '').trim();
  const key      = (event.queryStringParameters && event.queryStringParameters.key) || '';

  if (!password) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ADMIN_PASSWORD not set' }) };
  if (key !== password) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const store = getStore('rsvps');
    const { blobs } = await store.list();

    const submissions = await Promise.all(
      blobs.map(async b => {
        try { return await store.get(b.key, { type: 'json' }); }
        catch { return null; }
      })
    );

    const rsvps = submissions
      .filter(Boolean)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ submissions: rsvps, count: rsvps.length }) };
  } catch (err) {
    console.error('get-rsvps error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
