const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const api={};
runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname,'../src/lib/social.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api});
test('feed aceita texto ou imagem, sem título, e limita texto',()=>{
  assert.equal(api.publicationError('Olá',false),'');
  assert.equal(api.publicationError('',true),'');
  assert.ok(api.publicationError('  ',false));
  assert.ok(api.publicationError('a'.repeat(5001),true));
});
test('hashtags únicas e identidade sem identificador interno temporário',()=>{
  assert.deepEqual(Array.from(api.extractHashtags('Olá #PPO #ppo #Dúvidas #turma_2')),['ppo','dúvidas','turma_2']);
  assert.equal(api.socialHandle({username:'visitante000',display_name:'Charlie#eba',temporary_tag:'eba'}),'@Charlie#eba');
  assert.equal(api.socialHandle({username:'charlie',display_name:'Charlie'}),'@charlie');
});
