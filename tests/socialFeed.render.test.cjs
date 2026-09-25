const {test}=require('node:test');const assert=require('node:assert/strict');
const {renderFeed,entries}=require('./helpers/socialRender.cjs');
test('feed autenticado oferece compositor, perfil, comentários e reações',()=>{
  const html=renderFeed(entries);
  for(const expected of ['O que está acontecendo?','Publicar','type="file"','@Charlie#eba','curtidas','comentários','Ignites','aria-pressed="true"','/pessoas/charlie'])assert.ok(html.includes(expected),expected);
  assert.ok(html.indexOf('aria-label="12 curtidas"') < html.indexOf('aria-label="2 Ignites"'));
  assert.ok(html.indexOf('aria-label="2 Ignites"') < html.indexOf('aria-label="3 comentários"'));
  assert.ok(!html.includes('@internal'));
  for (const asset of ['/like-still.png','/comments.png','/ignite-still.png']) assert.ok(html.includes(`src="${asset}"`));
  assert.ok(!html.includes('.gif?play='));
  for (const emoji of ['♥','↩','🔥']) assert.ok(!html.includes(emoji));
});
test('feed sem sessão pede login sem exibir compositor',()=>{
  const html=renderFeed([], '');assert.ok(html.includes('Entre na sua conta'));assert.ok(!html.includes('id="publication"'));
});
