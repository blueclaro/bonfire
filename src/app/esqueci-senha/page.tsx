"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createRecoveryClient } from "@/lib/recoveryClient";
import { requestRecovery } from "@/lib/passwordRecovery";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const client = useRef<ReturnType<typeof createRecoveryClient>>(null);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || cooldown) return;
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try {
      client.current ||= createRecoveryClient();
      if (!client.current) throw new Error("Recuperação indisponível. Entre em contato com a equipe do Bonfire.");
      setMessage(await requestRecovery(client.current.auth, email, window.location.origin));
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível solicitar o link. Tente novamente.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#11100f] px-6 py-10 text-[#f6efe7]">
    <section className="w-full max-w-md">
      <Link href="/login" className="text-sm text-[#ffd19a]">← Voltar para login</Link>
      <h1 className="mt-6 text-3xl font-black">Esqueci minha senha</h1>
      <p className="mt-3 text-[#b9aaa0]">Informe o e-mail usado na sua conta para receber um link de recuperação.</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[.045] p-6">
        <label className="block text-sm text-[#b9aaa0]">E-mail escolar
          <input required type="email" autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white" />
        </label>
        {message && <p role="status" className="text-sm text-[#ffd19a]">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
        <button disabled={busy || cooldown > 0} className="w-full rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-50">{busy ? "Enviando…" : cooldown ? `Aguarde ${cooldown}s para reenviar` : "Enviar link de recuperação"}</button>
      </form>
    </section>
  </main>;
}
