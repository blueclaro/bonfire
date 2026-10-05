const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {runInNewContext} = require('node:vm');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ts = require('typescript');

function render(file, states, props = {}, pathname = '/') {
  let index = 0;
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../src', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020}
  }).outputText, {exports, Intl, Date, Set, require(name) {
    if (name === 'react') return {...React, useState: initial => [index < states.length ? states[index++] : initial, () => {}], useEffect: () => {}, useRef: initial => ({current: initial}), useCallback: fn => fn};
    if (name === 'next/navigation') return {usePathname: () => pathname};
    if (name === '@/lib/supabase') return {isSupabaseConfigured: true, supabase: {}};
    if (name === '@/components/Sidebar') return {default: () => null};
    if (name === '@/components/AccountModerationPanel') return {default: () => React.createElement('p', null, 'Fila de contas')};
    if (name === '@/components/ReportsPanel') return {default: () => React.createElement('p', null, 'Fila de denúncias')};
    return require(name);
  }});
  return renderToStaticMarkup(React.createElement(exports.default, props));
}

test('barreira oculta o conteúdo enquanto verifica, aguarda aprovação ou há erro', () => {
  for (const states of [[true, null, ''], [false, {approval_status: 'pending'}, ''], [false, null, 'Falha de conexão']]) {
    const html = render('components/AccountApprovalGate.tsx', states, {children: 'CONTEÚDO PRIVADO'});
    assert.ok(!html.includes('CONTEÚDO PRIVADO'));
  }
  const html = render('components/AccountApprovalGate.tsx', [false, {approval_status: 'pending'}, '']);
  assert.ok(html.includes('Aguardando aprovação'));
  assert.ok(html.includes('Verificar novamente'));
});

test('rejeição exibe o motivo com escape de HTML e mantém conteúdo bloqueado', () => {
  const html = render('components/AccountApprovalGate.tsx', [false, {approval_status: 'rejected', approval_reason: '<script>motivo</script>'}, ''], {children: 'CONTEÚDO PRIVADO'});
  assert.ok(html.includes('Cadastro não aprovado'));
  assert.ok(html.includes('&lt;script&gt;motivo&lt;/script&gt;'));
  assert.ok(!html.includes('CONTEÚDO PRIVADO'));
});

test('conta aprovada acessa conteúdo e recuperação de senha continua disponível', () => {
  assert.ok(render('components/AccountApprovalGate.tsx', [false, {approval_status: 'approved'}, ''], {children: 'CONTEÚDO PRIVADO'}).includes('CONTEÚDO PRIVADO'));
  assert.ok(render('components/AccountApprovalGate.tsx', [true, {approval_status: 'pending'}, ''], {children: 'RECUPERAÇÃO'}, '/redefinir-senha').includes('RECUPERAÇÃO'));
});

test('moderação mostra abas apenas à equipe e renderiza a fila selecionada', () => {
  const accounts = render('app/moderacao/page.tsx', ['accounts', true, false]);
  assert.ok(accounts.includes('Verificação de contas'));
  assert.ok(accounts.includes('Posts denunciados'));
  assert.ok(accounts.includes('Fila de contas'));
  assert.ok(!accounts.includes('Fila de denúncias'));
  const reports = render('app/moderacao/page.tsx', ['reports', true, false]);
  assert.ok(reports.includes('Fila de denúncias'));
  const denied = render('app/moderacao/page.tsx', ['accounts', false, false]);
  assert.ok(denied.includes('Área restrita'));
  assert.ok(!denied.includes('Fila de contas'));
});

test('fila desabilita aprovação de conta sem e-mail confirmado ou temporária expirada', () => {
  const accounts = [
    {id: 'verified', display_name: 'Confirmado', username: 'confirmado', email_verified: true},
    {id: 'unverified', display_name: 'Não confirmado', username: 'naoconfirmado', email_verified: false},
    {id: 'expired', display_name: 'Expirado', username: 'expirado', temporary_expires_at: '2020-01-01T00:00:00Z'}
  ].map(account => ({created_at: '2026-10-05T12:00:00Z', approval_status: 'pending', ...account}));
  const html = render('components/AccountModerationPanel.tsx', ['pending', 0, accounts, false, false, '', '', '', {}]);
  const cards = html.match(/<article[\s\S]*?<\/article>/g);
  assert.equal(cards.length, 3);
  assert.ok(!/button disabled=""[^>]*>Aprovar conta/.test(cards[0]));
  assert.ok(/button disabled=""[^>]*>Aprovar conta/.test(cards[1]));
  assert.ok(/button disabled=""[^>]*>Aprovar conta/.test(cards[2]));
});
