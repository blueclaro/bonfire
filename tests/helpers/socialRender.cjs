const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {runInNewContext}=require('node:vm');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const ts=require('typescript');
function renderFeed(entries=[],user='demo'){
  const states=[entries,user,false,'','','',null,'',false,'','','',false,0,null];let index=0;
  function load(path){const exports={};runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname,'../../src',path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Intl,require(name){
    if(name==='react')return {...React,useState:initial=>[index<states.length?states[index++]:initial,()=>{}],useEffect:()=>{},useRef:initial=>({current:initial}),useCallback:fn=>fn};
    if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children)};
    if(name==='@/lib/social')return load('lib/social.ts');
    if(name==='@/lib/supabase')return {supabase:{}};
    if(name==='@/components/SocialAvatar')return load('components/SocialAvatar.tsx');
    if(name==='@/components/ReactionIcon')return load('components/ReactionIcon.tsx');
    if(name==='@/components/SignedPostImage')return {default:()=>React.createElement('div',{'className':'mt-4 flex h-48 items-center justify-center rounded-xl bg-[#ff8a3d]/10 text-[#ffd19a]'},'Imagem de exemplo — prévia local')};
    if(name==='@/components/ReportButton')return {default:()=>React.createElement('button',{'className':'mt-3 text-xs'},'Denunciar')};
    return require(name);
  }});return exports;}
  return renderToStaticMarkup(React.createElement(load('components/SocialFeed.tsx').default));
}
const entries=[{event_id:'example',id:'00000000-0000-4000-8000-000000000010',title:'',content:'Quem vai apresentar o projeto amanhã? Bora trocar ideias! #PPO #Informática',image_path:'example.jpg',author_id:'charlie',author:{id:'charlie',username:'internal',display_name:'Charlie#eba',temporary_tag:'eba'},igniter:null,created_at:'2026-09-24T16:00:00Z',event_at:'2026-09-24T16:00:00Z',is_locked:false,can_ignite:true,likes:12,comments:3,ignites:2,liked:true,ignited:false}];
module.exports={renderFeed,entries};
