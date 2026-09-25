const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const read=path=>readFileSync(resolve(__dirname,'..',path),'utf8');

test('cadastro usa e-mail, nome com tag e avança para verificação',()=>{
  const page=read('src/app/cadastro/page.tsx');
  assert.ok(page.includes('>E-mail<input'));
  assert.ok(!page.includes('E-mail escolar'));
  assert.ok(page.includes('Nome de usuário'));
  assert.ok(page.includes('>Tag<'));
  assert.ok(page.includes('username:`${cleanUsername}#${cleanTag}`'));
  assert.ok(page.includes('router.push("/cadastro/verificacao")'));
});

test('verificação aceita seis caracteres e confirma o OTP real',()=>{
  const page=read('src/app/cadastro/verificacao/page.tsx');
  assert.ok(page.includes('maxLength={6}'));
  assert.ok(page.includes('pattern="[A-Za-z0-9]{6}"'));
  assert.ok(page.includes('supabase.auth.verifyOtp({email,token,type:"email"})'));
  assert.ok(page.includes('supabase.auth.resend({type:"signup",email})'));
  assert.ok(read('supabase/templates/confirmation.html').includes('{{ .Token }}'));
});

test('banco aceita identidade permanente nome#tag',()=>{
  const sql=read('supabase/migrations/20260925_permanent_profile_tags.sql');
  assert.ok(sql.includes('(#[A-Za-z0-9]{1,4})?'));
  assert.ok(sql.includes('profiles_username_casefold_unique'));
});
