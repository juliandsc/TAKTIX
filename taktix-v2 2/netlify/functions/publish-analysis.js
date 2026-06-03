const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function supabase(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { adminPassword, analysisId, matchId, action } = JSON.parse(event.body || '{}');

  if (adminPassword !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  try {
    if (action === 'publish') {
      // Publicar análisis
      await supabase(`/analyses?id=eq.${analysisId}`, 'PATCH', {
        is_published: true
      });
      // Actualizar estado del partido
      await supabase(`/matches?id=eq.${matchId}`, 'PATCH', {
        status: 'published'
      });
      return { statusCode: 200, body: JSON.stringify({ success: true, action: 'published' }) };
    }

    if (action === 'unpublish') {
      await supabase(`/analyses?id=eq.${analysisId}`, 'PATCH', { is_published: false });
      await supabase(`/matches?id=eq.${matchId}`, 'PATCH', { status: 'draft' });
      return { statusCode: 200, body: JSON.stringify({ success: true, action: 'unpublished' }) };
    }

    if (action === 'delete') {
      await supabase(`/matches?id=eq.${matchId}`, 'DELETE');
      return { statusCode: 200, body: JSON.stringify({ success: true, action: 'deleted' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Acción no válida' }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
