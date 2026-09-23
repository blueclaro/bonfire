"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createRecoveryClient } from "@/lib/recoveryClient";
import { createPasswordRecovery, invalidRecoveryLink } from "@/lib/passwordRecovery";

export default function ResetPasswordPage() {
  const flow = useRef<ReturnType<typeof createPasswordRecovery> | null>(null);
  const initialization = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    let live = true;
    if (!initialization.current) {
      const url = window.location.href;
      // Não mantenha credenciais na barra de endereço ou no histórico.
      window.history.replaceState(window.history.state, "", "/redefinir-senha");
      const client = createRecoveryClient();
      if (client) {
        flow.current = createPasswordRecovery(client.auth);
        initialization.current = flow.current.initialize(url);
      } else initialization.current = Promise.reject(new Error("Recuperação indisponível."));
    }
    void initialization.current.then(() => {
      if (live) setState("ready");
    }).catch(() => {
      if (live) { setState("invalid"); setError(invalidRecoveryLink); }
    });
    return () => { live = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || state !== "ready" || !flow.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      await flow.current.save(password, confirmation);
      setPassword(""); setConfirmation(""); setState("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a senha.");
    } finally { submitting.current = false; setBusy(false); }
  }
  const input = "mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white";
  return <main className="flex min-h-screen items-center justify-center bg-[#11100f] px-6 py-10 text-[#f6efe7]">
    <section className="w-full max-w-md">
      <h1 className="text-3xl font-black">Redefinir senha</h1>
      {state === "loading" && <p role="status" className="mt-5">Verificando o link de recuperação…</p>}
      {state === "done" ? <div className="mt-6 space-y-4"><p role="status">Senha atualizada. Entre novamente com sua nova senha.</p><Link href="/login" className="inline-block rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">Ir para login</Link></div> : <>
        {error && <p role="alert" className="mt-5 text-sm text-red-200">{error}</p>}
        {state === "ready" && <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[.045] p-6">
          <p className="text-sm text-[#b9aaa0]">Use pelo menos 8 caracteres. Escolha uma senha que você não utiliza em outros sites.</p>
          <label className="block text-sm text-[#b9aaa0]">Nova senha<input required type="password" autoComplete="new-password" minLength={8} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className={input} /></label>
          <label className="block text-sm text-[#b9aaa0]">Confirmar nova senha<input required type="password" autoComplete="new-password" minLength={8} value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} className={input} /></label>
          <button disabled={busy} className="w-full rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-50">{busy ? "Atualizando…" : "Salvar nova senha"}</button>
          <p className="text-xs text-[#b9aaa0]">Conclua nesta página. Se recarregá-la ou fechá-la, solicite um novo link.</p>
        </form>}
        {state !== "loading" && <Link href="/esqueci-senha" className="mt-5 inline-block text-sm text-[#ffd19a] underline">Solicitar outro link</Link>}
      </>}
    </section>
  </main>;
}
