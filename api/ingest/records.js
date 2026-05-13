const TARGET_URL = 'https://terminal-ops-web.vercel.app/api/ingest/records';
const API_KEY = '5f7a2c9e1b3d6f8a4c2e9d1f7b5a3c6e8d2f4b1a9c7e5d3f6a8b2c1e9d4f7a5c';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const upstreamResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request.body || {})
    });

    const rawBody = await upstreamResponse.text();
    let parsedBody;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody;
    }

    if (!upstreamResponse.ok) {
      return response.status(upstreamResponse.status).json({
        error: 'Falha ao enviar para o servidor de ingestão.',
        details: parsedBody
      });
    }

    if (parsedBody && typeof parsedBody === 'object') {
      return response.status(200).json(parsedBody);
    }

    return response.status(200).json({ ok: true, response: parsedBody });
  } catch (error) {
    return response.status(502).json({
      error: 'Erro de conexão com o servidor de ingestão.',
      details: error.message
    });
  }
}
