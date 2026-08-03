import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('exibe um campo do formulário por linha em qualquer largura de tela', () => {
  const formPanelRule = styles.match(/\.form-panel\s*{([^}]*)}/)?.[1] || '';

  assert.match(formPanelRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(formPanelRule, /repeat\(2/);
});
