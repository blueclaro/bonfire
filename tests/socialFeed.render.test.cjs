const {test}=require('node:test');const assert=require('node:assert/strict');
const {renderFeed,entries}=require('./helpers/socialRender.cjs');
test('feed autenticado oferece compositor, perfil, comentários e reações',()=>{
  const html=renderFeed(entries);
  for(const expected of ['O que está acontecendo?','Publicar','type="file"','@Charlie#eba','Curtidas','Comentários','Ignites','aria-pressed="true"','#novo-comentario','/pessoas/charlie'])assert.ok(html.includes(expected),expected);
  assert.ok(!html.includes('@internal'));
  for (const asset of ['/like.gif','/comments.png','/ignite.gif']) assert.ok(html.includes(`src="${asset}"`));
  for (const emoji of ['♥','↩','🔥']) assert.ok(!html.includes(emoji));
});
test('feed sem sessão pede login sem exibir compositor',()=>{
  const html=renderFeed([], '');assert.ok(html.includes('Entre na sua conta'));assert.ok(!html.includes('id="publication"'));
});
