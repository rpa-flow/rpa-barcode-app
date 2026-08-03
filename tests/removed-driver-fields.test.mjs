import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, javascript] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

test('não exibe campos de nome e telefone do motorista', () => {
  assert.doesNotMatch(html, /nomeMotoristaInput|telefoneInput/);
});

test('não inclui dados do motorista no payload', () => {
  assert.doesNotMatch(javascript, /nomeMotoristaInput|telefoneInput|motorista\s*:/);
});
