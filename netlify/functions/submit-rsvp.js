// Uses Netlify Blobs REST API directly — no npm packages needed
exports.handler = async function(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, email, phone, guests, type, message } = body;

    if (!name || !name.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name is required' }) };
    }

    // Netlify Blobs REST API — available automatically in all Netlify functions
    const token   = process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_FUNCTIONS_TOKEN;
    const siteId  = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;

    const id    = `rsvp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      name:    name.trim(),
      email:   (email   || '').trim(),
      phone:   (phone   || '').trim(),
      guests:  (guests  || '0').toString(),
      type:    (type    || 'yes'),
      message: (message || '').trim(),
      submittedAt: new Date().toISOString(),
    };

    // Store in Netlify Blobs via REST API
    const blobUrl = `https://blobs.netlify.com/${siteId}/rsvps/${id}`;
    const putRes  = await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });

    console.log('Blob PUT status:', putRes.status, 'for', id);

    if (!putRes.ok) {
      const txt = await putRes.text();
      throw new Error(`Blob store failed: ${putRes.status} — ${txt}`);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, id }) };

  } catch (err) {
    console.error('submit-rsvp error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
