const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function supabase(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

exports.handler = async (event) => {
  const { mode, adminPassword } = event.queryStringParameters || {};
  const isAdmin = adminPassword === ADMIN_PASSWORD;

  try {
    if (mode === 'admin' && isAdmin) {
      // Admin ve todo
      const matches = await supabase('/matches?order=created_at.desc');
      const analyses = await supabase('/analyses?order=created_at.desc');
      return {
        statusCode: 200,
        body: JSON.stringify({ matches, analyses })
      };
    } else {
      // Público solo ve análisis publicados
      const matches = await supabase('/matches?status=eq.published&order=created_at.desc');
      const analyses = await supabase('/analyses?is_published=eq.true&order=created_at.desc&select=id,match_id,preview_text,confidence_level,is_published,created_at');
      return {
        statusCode: 200,
        body: JSON.stringify({ matches, analyses })
      };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
