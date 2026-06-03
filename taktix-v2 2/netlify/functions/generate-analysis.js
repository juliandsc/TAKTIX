const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const SYSTEM_PROMPT = `# ANALISTA MUNDIAL 2026 — TAKTIX

Eres un analista profesional de fútbol especializado en la Copa del Mundo 2026. Tu trabajo es hacer análisis técnico, estadístico, táctico y contextual de cada partido.

NUNCA das consejos de apuesta directos.
NUNCA dices "apuesta a esto".
NUNCA mencionas cuotas o casas de apuestas.
SÍ analizas qué lectura tiene más solidez según los datos.
SÍ dices directamente cuál mercado tiene más sustento analítico.

Antes de analizar SIEMPRE buscas datos actualizados:
- Estado del grupo y clasificación
- Forma reciente (últimos 5 partidos)
- Bajas y convocatoria confirmada
- Estadísticas de goles y tiros a puerta
- Historial de enfrentamientos

NUNCA inventas datos. Si no encuentras algo, lo dices.

FORMATO DE ANÁLISIS:

### SITUACIÓN Y CONTEXTO
Fase, grupo, qué se juega cada equipo, motivación real.

### FORMA RECIENTE
Últimos 5 partidos (V/E/D), goles, momentum.

### BAJAS Y CONVOCATORIA
Jugadores ausentes, impacto: ALTO / MEDIO / BAJO.

### DISPAROS Y ATAQUE
Promedio SOT, eficiencia goleadora, señal para mercados.

### ANÁLISIS TÁCTICO
Sistema, estilo, emparejamiento clave, cómo se perfila el partido.

### FACTOR SEDE
Ciudad, altitud si aplica, ventaja local.

### PROBABILIDADES
| 1 | X | 2 |
|---|---|---|
| XX% | XX% | XX% |

### MERCADOS CON SEÑAL REAL
| Mercado | Lectura | Confianza |
Solo los que tienen base real. Confianza: ⭐ débil · ⭐⭐ media · ⭐⭐⭐ alta

### VEREDICTO DIRECTO
Lectura más sólida. Simple o combinada. Nivel: ALTO ✅ / MEDIO ⚠️ / BAJO ❌

Sé directo. Sin relleno. Datos concretos. Si es trampa, dilo.`;

async function supabase(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : undefined
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { adminPassword, matchId, matchName, phase, matchDate, matchTime, groupName, context } = JSON.parse(event.body || '{}');

  if (adminPassword !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  if (!matchName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el nombre del partido' }) };
  }

  try {
    // 1. Guardar partido en DB si no existe
    let currentMatchId = matchId;
    if (!currentMatchId) {
      const [teamA, teamB] = matchName.split(' vs ').map(t => t.trim());
      const newMatch = await supabase('/matches', 'POST', {
        name: matchName,
        team_a: teamA || matchName,
        team_b: teamB || '',
        phase: phase || 'Fase de grupos',
        match_date: matchDate || '',
        match_time: matchTime || '',
        group_name: groupName || '',
        context: context || '',
        status: 'pending'
      });
      currentMatchId = newMatch[0]?.id;
    }

    // 2. Llamar a Claude API con web search
    const userMsg = `Analiza este partido del Mundial 2026:
Partido: ${matchName}
Fase: ${phase || 'Fase de grupos'}
Fecha: ${matchDate || 'Por confirmar'}
Hora: ${matchTime || 'Por confirmar'}
${groupName ? `Grupo: ${groupName}` : ''}
${context ? `Contexto adicional: ${context}` : ''}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const claudeData = await claudeRes.json();

    if (!claudeData || !claudeData.content) {
      const errMsg = (claudeData && claudeData.error && claudeData.error.message) || JSON.stringify(claudeData);
      return { statusCode: 500, body: JSON.stringify({ error: 'Error Claude API: ' + errMsg }) };
    }

    const fullAnalysis = (claudeData.content || [])
      .filter(b => b && b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (!fullAnalysis) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Sin texto en respuesta: ' + JSON.stringify(claudeData.content) }) };
    }

    // 3. Detectar nivel de confianza
    let confidence = 'MEDIO';
    if (/ALTO|✅/.test(fullAnalysis)) confidence = 'ALTO';
    if (/BAJO|❌/.test(fullAnalysis)) confidence = 'BAJO';

    // 4. Generar preview (primeras 3 líneas con contenido)
    const previewText = fullAnalysis
      .split('\n')
      .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('|'))
      .slice(0, 3)
      .join('\n')
      .substring(0, 300) + '...';

    // 5. Guardar análisis en DB
    const analysis = await supabase('/analyses', 'POST', {
      match_id: currentMatchId,
      full_analysis: fullAnalysis,
      preview_text: previewText,
      confidence_level: confidence,
      is_published: false
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        matchId: currentMatchId,
        analysisId: analysis[0]?.id,
        preview: previewText,
        confidence,
        fullAnalysis
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
