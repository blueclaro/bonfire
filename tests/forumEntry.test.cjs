const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const api = {};
runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../src/lib/forumEntry.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: api });

test('criar tópico carrega categoria solicitada e preserva escolha manual', () => {
  const categories = [{ id: 'a' }, { id: 'b' }];
  assert.equal(api.forumCreationHref('b'), '/foruns?novo=1&categoria=b#novo-topico');
  assert.equal(api.initialForumCategory(categories, '', 'b'), 'b');
  assert.equal(api.initialForumCategory(categories, 'a', 'b'), 'a');
  assert.equal(api.initialForumCategory(categories, '', 'sem-acesso'), 'a');
  assert.equal(api.initialForumCategory([], '', 'b'), '');
});

test('categoria vazia oferece criação e destino abre formulário', () => {
  const category = readFileSync(resolve(__dirname, '../src/app/foruns/[categoryId]/page.tsx'), 'utf8');
  const forums = readFileSync(resolve(__dirname, '../src/app/foruns/page.tsx'), 'utf8');
  assert.ok(category.includes('Criar o primeiro tópico'));
  assert.ok(category.includes('href={forumCreationHref(category.id)}'));
  assert.ok(forums.includes('setShowForm(new URLSearchParams(window.location.search).get("novo") === "1")'));
  assert.ok(forums.includes('id="novo-topico"'));
});
