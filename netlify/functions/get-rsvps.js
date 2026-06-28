exports.handler = async function(event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const adminKey  = event.headers['x-admin-key'] || '';
  const password  = process.env.ADMIN_PASSWORD    || '';
  const NETLIFY_TOKEN   = process.env.NETLIFY_API_TOKEN || '';
  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID   || '';

  // ── DEBUG: always return what we see (remove after fixing) ──
  if (event.queryStringParameters && event.queryStringParameters.debug === '1') {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        receivedKey:      adminKey,
        receivedKeyLen:   adminKey.length,
        envPassword:      password ? password.replace(/./g, '*') : '(empty)',
        envPasswordLen:   password.length,
        match:            adminKey === password,
        hasToken:         !!NETLIFY_TOKEN,
        hasSiteId:        !!NETLIFY_SITE_ID,
        allEnvKeys:       Object.keys(process.env).filter(k => k.startsWith('NETLIFY') || k.startsWith('ADMIN')),
      }),
    };
  }

  if (!password) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ADMIN_PASSWORD env var not set.' }) };
  }

  if (adminKey !== password) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({
      error: 'Unauthorized — wrong admin password.',
      hint: `Key length: ${adminKey.length}, Env length: ${password.length}`
    })};
  }

  if (!NETLIFY_TOKEN)   return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'NETLIFY_API_TOKEN not set.' }) };
  if (!NETLIFY_SITE_ID) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'NETLIFY_SITE_ID not set.' }) };

  try {
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/forms`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );
    if (!formsRes.ok) throw new Error(`Forms API ${formsRes.status}: ${await formsRes.text()}`);

    const forms    = await formsRes.json();
    const rsvpForm = forms.find(f => f.name === 'rsvp');

    if (!rsvpForm) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ submissions: [], formFound: false }) };
    }

    let all = [], page = 1;
    while (true) {
      const subRes = await fetch(
        `https://api.netlify.com/api/v1/forms/${rsvpForm.id}/submissions?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
      );
      if (!subRes.ok) throw new Error(`Submissions ${subRes.status}`);
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

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ submissions, formFound: true }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
