"use client";
import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";

export default function VerificacaoPage(){
  const router=useRouter();
  const [email,setEmail]=useState(""),[code,setCode]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false),[resending,setResending]=useState(false);
  useEffect(()=>{setEmail(sessionStorage.getItem("bonfire_pending_email")||"");},[]);
  async function verify(event:FormEvent){
    event.preventDefault();const token=code.trim().toUpperCase();
    if(!email){setMessage("Volte ao cadastro e informe seu e-mail novamente.");return;}
    if(!/^[A-Z0-9]{6}$/.test(token)){setMessage("Digite os 6 caracteres do código recebido.");return;}
    setLoading(true);setMessage("");
    const {error}=await supabase.auth.verifyOtp({email,token,type:"email"});
    setLoading(false);
    if(error){setMessage("Código incorreto ou expirado. Confira o e-mail ou solicite outro código.");return;}
    sessionStorage.removeItem("bonfire_pending_email");router.replace("/");router.refresh();
  }
  async function resend(){
    if(!email)return;setResending(true);setMessage("");
    const {error}=await supabase.auth.resend({type:"signup",email});
    setResending(false);setMessage(error?"Não foi possível reenviar agora. Aguarde um minuto e tente novamente.":"Um novo código foi enviado.");
  }
  return <main className="min-h-screen bg-[#11100f] px-6 py-10"><section className="mx-auto max-w-xl"><Link href="/cadastro" className="text-sm text-[#ffd19a]">← Voltar ao cadastro</Link><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#ffd19a]">Etapa 2 de 2</p><h1 className="mt-2 text-4xl font-black">Verifique seu e-mail</h1><p className="mt-3 text-[#b9aaa0]">Enviamos um código de 6 caracteres para <strong className="break-all text-[#f6efe7]">{email||"seu e-mail"}</strong>.</p><form onSubmit={verify} className="mt-8 grid gap-5 rounded-2xl border border-white/10 bg-white/[.045] p-6"><label className="text-sm text-[#b9aaa0]">Código de verificação<input required autoFocus inputMode="text" autoComplete="one-time-code" aria-label="Código de verificação" maxLength={6} pattern="[A-Za-z0-9]{6}" value={code} onChange={event=>setCode(event.target.value.replace(/[^A-Za-z0-9]/g,"").toUpperCase())} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[.35em] text-white outline-none focus:border-[#ff8a3d]"/></label>{message&&<p role="status" className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}<button disabled={loading||code.length!==6||!email} className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-60">{loading?"Verificando...":"Verificar e entrar"}</button><button type="button" disabled={resending||!email} onClick={()=>void resend()} className="text-sm text-[#ffd19a] underline disabled:opacity-50">{resending?"Reenviando...":"Reenviar código"}</button></form></section></main>;
}
