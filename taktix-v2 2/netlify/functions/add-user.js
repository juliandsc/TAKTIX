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

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TKX-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { adminPassword, name, phone, email, method, amount, notes } = JSON.parse(event.body || '{}');

  if (adminPassword !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  if (!phone && !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Se requiere teléfono o email' }) };
  }

  try {
    // Generar código de acceso único
    const accessCode = generateCode();

    // Premium hasta el final del Mundial (19 julio 2026)
    const premiumUntil = new Date('2026-07-20T23:59:59Z').toISOString();

    // Crear usuario
    const user = await supabase('/users', 'POST', {
      name: name || 'Usuario',
      phone: phone || null,
      email: email || null,
      is_premium: true,
      premium_until: premiumUntil,
      access_code: accessCode
    });

    // Registrar pago
    if (user[0]?.id) {
      await supabase('/payments', 'POST', {
        user_id: user[0].id,
        amount: amount || 10,
        currency: 'USD',
        method: method || 'transferencia',
        status: 'confirmed',
        notes: notes || ''
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        accessCode,
        message: `Usuario creado. Código de acceso: ${accessCode}`
      })
    };

  } catch (err) {
    // Si el usuario ya existe, actualizar a premium
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Este teléfono/email ya tiene acceso registrado' })
      };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
