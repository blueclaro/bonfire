const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');

test('página de login identifica o campo somente como e-mail',()=>{
  const page=readFileSync(resolve(__dirname,'../src/app/login/page.tsx'),'utf8');
  assert.ok(page.includes('>E-mail<input'));
  assert.ok(!page.includes('E-mail escolar'));
});
