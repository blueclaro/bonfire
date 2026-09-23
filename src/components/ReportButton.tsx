"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ReportButton({ targetType, targetId }: { targetType: "post" | "comment" | "message"; targetId: string }) {
  const fieldId = useId();
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || reason.trim().length < 10) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("submit_report", { target_kind: targetType, target_uuid: targetId, report_reason: reason.trim() });
      if (error) {
        const messages: Record<string, string> = {
          "23505": "Você já tem uma denúncia pendente deste conteúdo.",
          "42501": "Entre na sua conta e verifique se ainda tem acesso a este conteúdo.",
          "22023": "Descreva o motivo em 10 a 2000 caracteres.",
          "P0001": "Limite de denúncias atingido. Tente novamente mais tarde.",
        };
        setMessage(messages[error.code] || "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSent(true);
      setOpen(false);
      setReason("");
    } catch {
      setMessage("Falha de conexão. Tente novamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (sent) return <p role="status" className="mt-3 text-xs text-[#ffd19a]">Denúncia enviada para análise.</p>;
  return <div className="mt-3 text-sm font-normal">
    <button type="button" aria-expanded={open} aria-controls={fieldId + "-form"} disabled={busy} onClick={() => setOpen(!open)} className="text-xs text-[#b9aaa0] hover:text-white hover:underline">Denunciar</button>
    {open && <form id={fieldId + "-form"} onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#171310] p-4 text-white">
      <label htmlFor={fieldId} className="block">Por que você está denunciando?</label>
      <p className="text-xs text-[#b9aaa0]">O motivo ficará visível apenas para a equipe de moderação. Descreva o problema sem incluir dados pessoais desnecessários.</p>
      <textarea id={fieldId} required minLength={10} maxLength={2000} rows={3} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 p-3 outline-none focus:border-[#ff8a3d]" />
      {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || reason.trim().length < 10} className="rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e] disabled:opacity-50">{busy ? "Enviando…" : "Enviar denúncia"}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-3 py-2">Cancelar</button>
      </div>
    </form>}
  </div>;
}
