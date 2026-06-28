// Netlify Function: get-rsvps.js
// CommonJS format — works out of the box with Netlify Functions

exports.handler = async function(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Content-Type': 'application/json',
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // ── Auth ──────────────────────────────────────────────────
  const adminKey = (event.headers['x-admin-key'] || '').trim();
  const password = (process.env.ADMIN_PASSWORD || '').trim();

  if (!password) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'ADMIN_PASSWORD env var not set. Add it in Netlify → Site configuration → Environment variables and redeploy.' }),
    };
  }

  if (adminKey !== password) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: 'Unauthorized — wrong admin password.' }),
    };
  }

  // ── Netlify credentials ───────────────────────────────────
  const NETLIFY_TOKEN   = (process.env.NETLIFY_API_TOKEN || '').trim();
  const NETLIFY_SITE_ID = (process.env.NETLIFY_SITE_ID || '').trim();

  if (!NETLIFY_TOKEN) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'NETLIFY_API_TOKEN env var not set.' }),
    };
  }
  if (!NETLIFY_SITE_ID) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'NETLIFY_SITE_ID env var not set.' }),
    };
  }

  try {
    // 1. Get forms list
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/forms`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );

    if (!formsRes.ok) {
      const txt = await formsRes.text();
      throw new Error(`Netlify API error ${formsRes.status}: ${txt}`);
    }

    const forms = await formsRes.json();
    const rsvpForm = forms.find(f => f.name === 'rsvp');

    if (!rsvpForm) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ submissions: [], formFound: false }),
      };
    }

    // 2. Fetch all submissions (paginated)
    let all = [];
    let page = 1;
    while (true) {
      const subRes = await fetch(
        `https://api.netlify.com/api/v1/forms/${rsvpForm.id}/submissions?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
      );
      if (!subRes.ok) throw new Error(`Submissions fetch error ${subRes.status}`);
      const batch = await subRes.json();
      if (!Array.isArray(batch) || !batch.length) break;
      all = all.concat(batch);
      if (batch.length < 100) break;
      page++;
    }

    const submissions = all.map(s => ({
      name:        (s.data && s.data.name)    || '',
      email:       (s.data && s.data.email)   || '',
      phone:       (s.data && s.data.phone)   || '',
      guests:      (s.data && s.data.guests)  || '0',
      type:        (s.data && s.data.type)    || 'yes',
      message:     (s.data && s.data.message) || '',
      submittedAt: s.created_at || '',
    }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ submissions, formFound: true }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
