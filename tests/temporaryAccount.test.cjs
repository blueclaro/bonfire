const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {runInNewContext}=require("node:vm");
const ts=require("typescript");
const api={};
runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname,"../src/lib/temporaryAccount.ts"),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText,{exports:api});
test("identidade temporária aceita letras e números, mas não símbolos na tag",()=>{
  assert.equal(api.temporaryIdentityError("CharlieLegal","bubu"),"");
  for (const tag of ["a", "12", "B1b2", "1234"]) assert.equal(api.temporaryIdentityError("  João Silva  ",tag),"");
  for(const tag of ["á","com espaço","x#","x_","x-","", "abcde", "x".repeat(17)]) assert.ok(api.temporaryIdentityError("Charlie",tag));
  for(const name of ["A","A#B","A\nB","A".repeat(33)]) assert.ok(api.temporaryIdentityError(name,"bubu"));
});
test("formulário usa a nova identidade de exemplo e explica a combinação única",()=>{
  const page=readFileSync(resolve(__dirname,"../src/app/conta-temporaria/page.tsx"),"utf8");
  for(const expected of ['placeholder="NomeDeExemplo"','placeholder="abu"','nome#tag deve ser único'])assert.ok(page.includes(expected),expected);
  assert.ok(!page.includes('placeholder="CharlieLegal"'));
  assert.ok(!page.includes('placeholder="bubu"'));
});
test("sessão local inválida não bloqueia a consulta da entrada temporária",()=>{
  const page=readFileSync(resolve(__dirname,"../src/app/conta-temporaria/page.tsx"),"utf8");
  const status=page.indexOf('const status = await supabase.rpc("temporary_access_status")');
  const access=page.indexOf('setAccess(status.data)');
  const auth=page.indexOf('const auth = await supabase.auth.getUser()',status);
  assert.ok(status>=0 && access>status && auth>access);
  assert.ok(page.includes('await supabase.auth.signOut({ scope: "local" })'));
  assert.ok(!page.includes('Promise.all([supabase.rpc("temporary_access_status")'));
});
test("QR Code é gerado localmente para a página pública, sem credenciais",async()=>{
  const qr=require("qrcode");
  const image=await qr.toDataURL("https://bonfire-iota.vercel.app/conta-temporaria",{errorCorrectionLevel:"M"});
  assert.ok(image.startsWith("data:image/png;base64,"));
});
