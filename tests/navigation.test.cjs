const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderSidebar(open) {
  const api = {};
  const source = readFileSync(resolve(__dirname, '../src/components/Sidebar.tsx'), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText, { exports: api, require(name) {
    if (name === 'react') return { ...React, useState: () => [open, () => {}] };
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name.startsWith('@/components/')) return { default: () => null };
    return require(name);
  }});
  return renderToStaticMarkup(React.createElement(api.default, { active: 'foruns' }));
}

test('menu mobile inicia fechado e mantém navegação desktop acessível', () => {
  const html = renderSidebar(false);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="main-navigation"/);
  assert.match(html, /id="main-navigation" class="hidden pt-4 xl:block/);
  assert.match(html, /href="\/foruns" aria-current="page"/);
  assert.doesNotMatch(html, /Crie sua conta temporária|href="\/conta-temporaria"/);
});

test('menu aberto expõe links e ação para fechar', () => {
  const html = renderSidebar(true);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, />Fechar<\/button>/);
  assert.match(html, /id="main-navigation" class="block pt-4 xl:block/);
  for (const href of ['/', '/foruns', '/chats', '/avisos', '/perfil']) assert.ok(html.includes(`href="${href}"`));
});
