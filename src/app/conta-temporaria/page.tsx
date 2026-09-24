"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { temporaryIdentityError } from "@/lib/temporaryAccount";

type Access = { enabled: boolean; access_enabled: boolean; available: boolean; duration_hours: number };
type Existing = { id: string; temporary: boolean; name: string; expires: string | null };
export default function TemporaryAccountPage() {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sending = useRef(false);
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError("");
      try {
        if (!isSupabaseConfigured) throw new Error();
        const [status, auth] = await Promise.all([supabase.rpc("temporary_access_status"), supabase.auth.getUser()]);
        if (status.error) throw status.error;
        if (auth.error && auth.error.name !== "AuthSessionMissingError") throw auth.error;
        if (!live) return;
        setAccess(status.data);
        if (auth.data.user) {
          const { data, error: profileError } = await supabase.from("profiles").select("display_name,temporary_expires_at").eq("id", auth.data.user.id).single();
          if (profileError) throw profileError;
          if (live) setExisting({ id: auth.data.user.id, temporary: !!data.temporary_expires_at, name: data.display_name, expires: data.temporary_expires_at });
        } else setExisting(null);
      } catch { if (live) setError("Não foi possível consultar a entrada temporária. Verifique a conexão e tente novamente."); }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, [retry]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    const invalid = temporaryIdentityError(name, tag);
    if (invalid) { setError(invalid); return; }
    sending.current = true; setBusy(true); setError("");
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error && auth.error.name !== "AuthSessionMissingError") throw new Error("Não foi possível verificar sua sessão. Tente novamente antes de criar uma conta.");
      if (auth.data.user) { setRetry(n => n + 1); return; }
      const { data, error: signupError } = await supabase.auth.signInAnonymously({
        options: { data: { temporary_name: name.trim(), temporary_tag: tag } },
      });
      if (signupError || !data.user) {
        if (signupError?.code === "anonymous_provider_disabled") throw new Error("O login anônimo está desativado no Supabase. A organização precisa ativar Allow anonymous sign-ins e salvar.");
        if (signupError?.status === 429) throw new Error("Limite de entradas atingido nesta rede. Avise quem está apresentando.");
        throw new Error("Não foi possível criar a conta. A tag pode estar em uso ou as inscrições podem ter fechado. Tente outra tag ou avise a organização.");
      }
      setRetry(n => n + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de conexão. Tente novamente."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function leave() {
    if (!window.confirm("Sair desta conta? Uma conta temporária não pode ser recuperada pelo nome ou tag.")) return;
    setBusy(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setExisting(null); setRetry(n => n + 1);
    } catch { setError("Não foi possível sair. Tente novamente."); }
    finally { setBusy(false); }
  }
  const input = "mt-2 w-full rounded-lg border border-white/20 bg-black/20 px-4 py-3 text-white";
  const expired = existing?.expires && new Date(existing.expires).getTime() <= Date.now();
  const closed = existing?.temporary && access?.access_enabled === false;
  return <main className="min-h-screen bg-[#11100f] px-5 py-10 text-[#f6efe7]"><section className="mx-auto max-w-xl">
    <Link href="/" className="text-sm text-[#ffd19a]">← Voltar ao Bonfire</Link>
    <p className="mt-8 text-sm font-bold uppercase tracking-widest text-[#ffd19a]">Apresentação do Bonfire</p>
    <h1 className="mt-3 text-4xl font-black">Crie sua conta temporária no Bonfire!</h1>
    <p className="mt-4 text-[#b9aaa0]">Sem e-mail e sem senha. Participe dos fóruns gerais, publique comentários e converse no chat.</p>
    {error && <p role="alert" className="mt-5 text-red-200">{error} <button onClick={() => setRetry(n => n + 1)} className="underline">Atualizar</button></p>}
    {loading ? <p role="status" className="mt-6">Verificando entrada…</p> : existing ? <div className="mt-6 space-y-4 rounded-xl border border-white/15 p-6">
      <h2 className="text-xl font-bold">{existing.name}</h2>
      <p>{existing.temporary ? expired ? "Esta conta temporária expirou." : closed ? "A organização encerrou o acesso temporário." : "Sua conta temporária está pronta neste navegador." : "Você já está conectado com sua conta permanente."}</p>
      {existing.expires && <p className="text-sm text-[#b9aaa0]">Válida até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(existing.expires))}.</p>}
      {!expired && !closed && <Link href="/foruns" className="inline-block rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">Entrar no Bonfire</Link>}
      <button disabled={busy} onClick={() => void leave()} className="block text-sm text-[#ffd19a] underline">Sair desta conta</button>
    </div> : access?.enabled && access.available ? <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-white/[.045] p-6">
      <label className="block">Seu nome ou apelido<input required minLength={2} maxLength={32} autoComplete="nickname" value={name} disabled={busy} onChange={e => setName(e.target.value)} placeholder="CharlieLegal" className={input} /></label>
      <label className="block">Sua tag<span className="mt-2 flex items-center gap-2"><span aria-hidden="true">#</span><input required pattern="[A-Za-z0-9]{1,4}" maxLength={4} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={tag} disabled={busy} onChange={e => setTag(e.target.value)} placeholder="bubu" aria-describedby="tag-help" className={input} /></span></label>
      <p id="tag-help" className="text-sm text-[#b9aaa0]">De 1 a 4 caracteres: somente letras de A a Z e números. Sem espaços, acentos ou símbolos. Cada tag é exclusiva; Bubu e bubu são a mesma tag.</p>
      <p className="break-words text-[#ffd19a]">Você aparecerá como <strong>{name.trim() || "CharlieLegal"}#{tag || "bubu"}</strong></p>
      <p className="text-sm text-[#b9aaa0]">Duração: {access.duration_hours} horas. Não saia da conta nem limpe os dados do navegador: não há recuperação por nome ou tag. Suas publicações ficam visíveis à comunidade e sujeitas à moderação.</p>
      <button disabled={busy} className="w-full rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-50">{busy ? "Criando…" : "Criar conta e participar"}</button>
    </form> : !error && <p className="mt-6 rounded-xl border border-white/15 p-5">A entrada temporária está fechada ou atingiu o limite de participantes. Aguarde a orientação de quem está apresentando.</p>}
  </section></main>;
}
