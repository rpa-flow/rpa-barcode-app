import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, javascript] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

test('campo manual inicia oculto e só aparece quando usuário escolhe digitar', () => {
  assert.match(html, /id="manualModeBtn"[^>]*>Digitar manualmente/);
  assert.match(html, /id="manualCodeField"[^>]*hidden/);
  assert.match(javascript, /function showManualCodeInput\(\)/);
  assert.match(javascript, /manualCodeField\.hidden = false/);
  assert.match(javascript, /manualModeBtn\.addEventListener\('click', showManualCodeInput\)/);
});

test('iniciar leitura por câmera oculta a entrada manual', () => {
  assert.match(javascript, /function hideManualCodeInput\(\)/);
  assert.match(javascript, /async function startCamera\(\) \{\n  hideManualCodeInput\(\)/);
});
