import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [javascript, proxy] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../api/ingest/notes.js', import.meta.url), 'utf8')
]);

test('envia os dados do app pelo proxy de notas', () => {
  assert.match(javascript, /endpoint = ['"]\/api\/ingest\/notes['"]/);
  assert.match(proxy, /https:\/\/terminal-ops-web\.vercel\.app\/api\/ingest\/notes/);
});

test('proxy autentica a chamada à API de notas', () => {
  assert.match(proxy, /['"]x-api-key['"]:\s*API_KEY/);
  assert.match(proxy, /['"]Content-Type['"]:\s*['"]application\/json['"]/);
});

test('payload contém os campos esperados pela API de notas', () => {
  for (const field of ['dataHora', 'nota', 'emitente', 'veiculo', 'recebimento', 'terminal']) {
    assert.match(javascript, new RegExp(`\\b${field}\\s*:`));
  }
});
