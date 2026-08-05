import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const javascript = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('preenche o fornecedor pelo CNPJ extraído da chave mesmo quando não existe opção no select', () => {
  assert.match(javascript, /function selecionarFornecedorPorCnpj\(cnpj\)/);
  assert.match(javascript, /buscarFornecedorPorCnpj\(cnpj\)/);
  assert.match(javascript, /fornecedorInput\.appendChild\(option\)/);
  assert.match(javascript, /fornecedorInput\.value = fornecedor/);
});
