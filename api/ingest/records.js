import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_URL = 'https://terminal-ops-web.vercel.app/api/ingest/records';
const API_KEY = '5f7a2c9e1b3d6f8a4c2e9d1f7b5a3c6e8d2f4b1a9c7e5d3f6a8b2c1e9d4f7a5c';
const CONFIG_PATH = path.join(process.cwd(), 'config', 'app-config.json');
let configCache;

function normalizarCnpj(cnpj) {
  return String(cnpj || '').replace(/\D/g, '');
}

function normalizarMapaFornecedores(fornecedoresPorCnpj = {}) {
  return Object.entries(fornecedoresPorCnpj).reduce((mapa, [cnpj, fornecedor]) => {
    const cnpjNormalizado = normalizarCnpj(cnpj);
    if (cnpjNormalizado && fornecedor) mapa[cnpjNormalizado] = fornecedor;
    return mapa;
  }, {});
}

async function carregarConfig() {
  if (configCache) return configCache;

  const rawConfig = await readFile(CONFIG_PATH, 'utf8');
  const config = JSON.parse(rawConfig);
  configCache = {
    fornecedoresPorCnpj: normalizarMapaFornecedores(config.fornecedoresPorCnpj)
  };

  return configCache;
}

async function buscarFornecedorPorCnpj(cnpj) {
  const config = await carregarConfig();
  return config.fornecedoresPorCnpj[normalizarCnpj(cnpj)] || '';
}

async function enriquecerPayloadComFornecedor(payload) {
  const safePayload = payload && typeof payload === 'object' ? { ...payload } : {};
  const emitente = safePayload.emitente && typeof safePayload.emitente === 'object' ? { ...safePayload.emitente } : {};
  const fornecedor = emitente.fornecedor || await buscarFornecedorPorCnpj(emitente.cnpj);

  safePayload.emitente = {
    ...emitente,
    fornecedor
  };

  return safePayload;
}

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
    const payload = await enriquecerPayloadComFornecedor(request.body || {});
    const upstreamResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
