"use client";
import {FormEvent,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {isSupabaseConfigured,supabase} from "@/lib/supabase";

const USERNAME=/^[A-Za-z0-9_!*/.+-]{3,24}$/;
const TAG=/^[A-Za-z0-9]{1,4}$/;

export default function CadastroPage(){
  const router=useRouter();
  const [name,setName]=useState(""),[username,setUsername]=useState(""),[tag,setTag]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault();
    const cleanUsername=username.trim().replace(/^@/,"").toLowerCase(),cleanTag=tag.trim().replace(/^#/,"").toLowerCase(),cleanEmail=email.trim().toLowerCase();
    if(!USERNAME.test(cleanUsername)){setMessage("O nome de usuário deve ter de 3 a 24 caracteres, sem espaços. Use letras, números ou _ ! * / . + -.");return;}
    if(!TAG.test(cleanTag)){setMessage("A tag deve ter de 1 a 4 letras ou números, sem espaços.");return;}
    if(password.length<6){setMessage("A senha precisa ter pelo menos 6 caracteres.");return;}
    if(password!==confirm){setMessage("As senhas não coincidem.");return;}
    if(!isSupabaseConfigured){setMessage("Configure o arquivo .env.local antes de cadastrar.");return;}
    setLoading(true);setMessage("");
    const {data,error}=await supabase.auth.signUp({email:cleanEmail,password,options:{data:{full_name:name.trim(),username:`${cleanUsername}#${cleanTag}`,class_name:"2º Informática"}}});
    if(error){setLoading(false);setMessage(error.code==="unexpected_failure"?"Não foi possível criar essa identidade. Tente outro nome ou tag.":error.message);return;}
    if(data.session) await supabase.auth.signOut();
    sessionStorage.setItem("bonfire_pending_email",cleanEmail);
    setLoading(false);router.push("/cadastro/verificacao");
  }
  const input="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#ff8a3d]";
  return <main className="min-h-screen bg-[#11100f] px-6 py-10"><section className="mx-auto max-w-2xl"><Link href="/login" className="text-sm text-[#ffd19a]">← Voltar para login</Link><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#ffd19a]">Etapa 1 de 2</p><h1 className="mt-2 text-4xl font-black">Criar conta</h1><p className="mt-2 text-[#b9aaa0]">Entre na comunidade do Bonfire.</p><form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-6"><label className="text-sm text-[#b9aaa0]">Nome completo<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className={input}/></label><div className="grid gap-4 sm:grid-cols-[1fr_9rem]"><label className="text-sm text-[#b9aaa0]">Nome de usuário<div className="mt-2 flex rounded-lg border border-white/10 bg-black/20 focus-within:border-[#ff8a3d]"><span className="px-4 py-3 text-[#7d7068]">@</span><input required pattern="[A-Za-z0-9_!*/.+-]{3,24}" maxLength={24} autoCapitalize="none" value={username} onChange={e=>setUsername(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-white outline-none"/></div></label><label className="text-sm text-[#b9aaa0]">Tag<div className="mt-2 flex rounded-lg border border-white/10 bg-black/20 focus-within:border-[#ff8a3d]"><span className="px-3 py-3 text-[#7d7068]">#</span><input required pattern="[A-Za-z0-9]{1,4}" maxLength={4} autoCapitalize="none" value={tag} onChange={e=>setTag(e.target.value.replace(/[^A-Za-z0-9]/g,""))} className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-white outline-none"/></div></label></div><p className="-mt-2 text-xs text-[#b9aaa0]">Você aparecerá como @{username.trim().replace(/^@/,"")||"nomedeusuario"}#{tag.trim().replace(/^#/,"")||"tag"}.</p><label className="text-sm text-[#b9aaa0]">E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={input}/></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm text-[#b9aaa0]">Senha<input required type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={input}/></label><label className="text-sm text-[#b9aaa0]">Confirmar senha<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={input}/></label></div>{message&&<p role="alert" className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}<button disabled={loading} className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-60">{loading?"Enviando código...":"Continuar"}</button></form></section></main>;
}
