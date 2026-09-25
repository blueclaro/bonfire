const {test}=require('node:test');const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');const {resolve}=require('node:path');const {runInNewContext}=require('node:vm');const ts=require('typescript');
function harness(reduced=false){
  let playing=false,previous='',effect,timeout,delay=0,cleared=false;
  const ref={current:undefined},api={};
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname,'../src/components/ReactionIcon.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,window:{matchMedia:()=>({matches:reduced})},setTimeout:(fn,ms)=>{delay=ms;timeout=fn;return 1;},clearTimeout:()=>{cleared=true;},require:name=>name==='react'?{useState:()=>[playing,value=>{playing=value;}],useRef:()=>ref,useEffect:(fn,deps)=>{const key=JSON.stringify(deps);if(previous!==key){previous=key;effect=fn;}}}:require(name)});
  return {render(props){api.default(props);if(effect){const run=effect;effect=null;run();}return api.default(props);},finish(){timeout();},get delay(){return delay;},get cleared(){return cleared;}};
}
test('ícones começam parados, inclusive quando não há clique',()=>{
  for(const kind of ['like','ignite'])assert.equal(harness().render({kind}).props.src,`/${kind}-still.png`);
});
test('coração recebe correção vertical sem deslocar os outros ícones',()=>{
  assert.ok(harness().render({kind:'like'}).props.className.includes('-translate-y-1'));
  assert.ok(!harness().render({kind:'ignite'}).props.className.includes('-translate-y-1'));
  assert.ok(!harness().render({kind:'comment'}).props.className.includes('-translate-y-1'));
});
test('reação toca uma vez após carregar e retorna ao frame estático',()=>{
  const h=harness();let icon=h.render({kind:'like',playKey:1});assert.equal(icon.props.src,'/like.gif?play=1');icon.props.onLoad();assert.equal(h.delay,2400);h.finish();assert.equal(h.render({kind:'like',playKey:1}).props.src,'/like-still.png');
  icon=h.render({kind:'like',playKey:2});assert.equal(icon.props.src,'/like.gif?play=2');
  assert.equal(h.render({kind:'like',playKey:0}).props.src,'/like-still.png');
});
test('ignite permanece visível por três ciclos completos',()=>{const h=harness();const icon=h.render({kind:'ignite',playKey:1});icon.props.onLoad();assert.equal(h.delay,6500);});
test('movimento reduzido e erro de carregamento mantêm ícone parado',()=>{
  assert.equal(harness(true).render({kind:'ignite',playKey:1}).props.src,'/ignite-still.png');
  const h=harness();h.render({kind:'ignite',playKey:1}).props.onError();assert.equal(h.render({kind:'ignite',playKey:1}).props.src,'/ignite-still.png');
  assert.equal(harness().render({kind:'comment',playKey:1}).props.src,'/comments.png');
});
