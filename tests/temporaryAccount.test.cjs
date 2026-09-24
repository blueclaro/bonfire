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
test("QR Code é gerado localmente para a página pública, sem credenciais",async()=>{
  const qr=require("qrcode");
  const image=await qr.toDataURL("https://bonfire-iota.vercel.app/conta-temporaria",{errorCorrectionLevel:"M"});
  assert.ok(image.startsWith("data:image/png;base64,"));
});
