// Uses Netlify Blobs REST API directly — no npm packages needed
exports.handler = async function(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const password = (process.env.ADMIN_PASSWORD || '').trim();
  const key      = ((event.queryStringParameters || {}).key || '').trim();

  if (!password) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ADMIN_PASSWORD env var not set' }) };
  if (key !== password) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const token  = process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_FUNCTIONS_TOKEN;
    const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;

    // List all blobs in rsvps store
    const listUrl = `https://blobs.netlify.com/${siteId}/rsvps?prefix=rsvp_`;
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Blob LIST status:', listRes.status);

    if (!listRes.ok) {
      const txt = await listRes.text();
      throw new Error(`Blob list failed: ${listRes.status} — ${txt}`);
    }

    const listData = await listRes.json();
    const keys     = (listData.blobs || listData.keys || []).map(b => b.key || b);

    // Fetch each entry
    const submissions = await Promise.all(keys.map(async k => {
      try {
        const r = await fetch(`https://blobs.netlify.com/${siteId}/rsvps/${k}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return r.ok ? r.json() : null;
      } catch { return null; }
    }));

    const rsvps = submissions
      .filter(Boolean)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ submissions: rsvps, count: rsvps.length }) };

  } catch (err) {
    console.error('get-rsvps error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
