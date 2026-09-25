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
  return renderToStaticMarkup(React.createElement(api.default, { active: 'inicio' }));
}

test('menu mobile inicia fechado e mantém navegação desktop acessível', () => {
  const html = renderSidebar(false);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="main-navigation"/);
  assert.match(html, /id="main-navigation" data-open="false" class="mobile-navigation"/);
  assert.match(html, /href="\/" aria-current="page"/);
  assert.doesNotMatch(html, /href="\/foruns"|Salas ativas/);
  assert.doesNotMatch(html, /Crie sua conta temporária|href="\/conta-temporaria"/);
});

test('menu aberto expõe links e ação para fechar', () => {
  const html = renderSidebar(true);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, />Fechar<\/button>/);
  assert.match(html, /id="main-navigation" data-open="true" class="mobile-navigation"/);
  for (const href of ['/', '/mensagens', '/chats', '/avisos', '/perfil']) assert.ok(html.includes(`href="${href}"`));
});

test('animação respeita movimento reduzido e tópicos oferecem acesso ao formulário', () => {
  const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf8');
  assert.match(css, /grid-template-rows 240ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const topic = readFileSync(resolve(__dirname, '../src/app/foruns/topico/[postId]/page.tsx'), 'utf8');
  assert.ok(topic.includes('href="#novo-comentario"'));
  assert.ok(topic.includes('id="novo-comentario"'));
  assert.ok(topic.includes('onSubmit={handleComment}'));
});
