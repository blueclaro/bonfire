"use client";
import { useEffect,useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import { SocialAuthor,socialHandle } from '@/lib/social';
type Person=SocialAuthor & {id:string;bio:string;school_label:string};
export default function PersonPage(){
  const {profileId}=useParams<{profileId:string}>();
  const [person,setPerson]=useState<Person|null>(null), [error,setError]=useState(''), [own,setOwn]=useState(false);
  useEffect(()=>{let live=true;setPerson(null);setError('');void (async()=>{try{const auth=await supabase.auth.getUser();if(!auth.data.user)throw new Error('Entre na sua conta para ver este perfil.');const result=await supabase.from('profiles').select('id,username,display_name,temporary_tag,avatar_url,bio,school_label').eq('id',profileId).single();if(result.error)throw new Error('Perfil indisponível.');if(live){setPerson(result.data);setOwn(profileId===auth.data.user.id);}}catch(cause){if(live)setError(cause instanceof Error?cause.message:'Falha ao carregar perfil.');}})();return()=>{live=false;};},[profileId]);
  return <main className="app-shell grid min-h-screen xl:grid-cols-[260px_1fr]"><Sidebar active="perfil" showRooms={false}/><section className="mx-auto w-full max-w-2xl p-5 md:p-8"><Link href="/" className="text-[#ffd19a]">← Voltar ao feed</Link>{error?<p role="alert" className="mt-6">{error} <Link href="/login" className="underline">Entrar</Link></p>:person?<article className="mt-6 rounded-2xl border border-white/10 p-6">{person.avatar_url?<img src={person.avatar_url} alt="Foto do perfil" referrerPolicy="no-referrer" className="h-20 w-20 rounded-full object-cover"/>:<div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ff8a3d]/20 text-3xl">{(person.display_name||person.username||'B')[0]}</div>}<h1 className="mt-4 break-words text-3xl font-black">{person.display_name||person.username}</h1><p className="mt-2 break-all text-[#b9aaa0]">{socialHandle(person)}</p>{person.school_label&&<p className="mt-3 inline-block rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-xs text-[#ffd19a]">🏷️ {person.school_label}</p>}<p className="mt-6 whitespace-pre-wrap break-words">{person.bio||'Ainda sem biografia.'}</p><Link href={own?'/perfil':`/mensagens?para=${person.id}`} className="mt-6 inline-block rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">{own?'Editar meu perfil':'Enviar mensagem'}</Link></article>:<p className="mt-6">Carregando perfil…</p>}</section></main>;
}
