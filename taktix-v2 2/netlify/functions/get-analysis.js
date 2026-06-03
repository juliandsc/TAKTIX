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
  const { analysisId, accessCode, adminPassword } = event.queryStringParameters || {};
  const isAdmin = adminPassword === ADMIN_PASSWORD;

  if (!analysisId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta analysisId' }) };
  }

  try {
    // Admin siempre puede ver todo
    if (isAdmin) {
      const data = await supabase(`/analyses?id=eq.${analysisId}`);
      return { statusCode: 200, body: JSON.stringify({ analysis: data[0], premium: true }) };
    }

    // Verificar acceso premium por código
    if (accessCode) {
      const users = await supabase(`/users?access_code=eq.${accessCode}&is_premium=eq.true`);
      if (users.length > 0) {
        const user = users[0];
        // Verificar que el acceso no haya expirado
        if (!user.premium_until || new Date(user.premium_until) > new Date()) {
          const data = await supabase(`/analyses?id=eq.${analysisId}&is_published=eq.true`);
          return { statusCode: 200, body: JSON.stringify({ analysis: data[0], premium: true }) };
        }
      }
    }

    // Sin acceso — devolver solo preview
    const data = await supabase(`/analyses?id=eq.${analysisId}&is_published=eq.true&select=id,preview_text,confidence_level`);
    return { statusCode: 200, body: JSON.stringify({ analysis: data[0], premium: false }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
