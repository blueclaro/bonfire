"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Event = { id: string; action: string; reason: string; actor_name: string; created_at: string };
export default function ReportedContentActions({ reportId, targetType, targetId }: { reportId: string; targetType: string; targetId: string }) {
  const field = useId();
  const version = useRef(0);
  const saving = useRef(false);
  const [removed, setRemoved] = useState<boolean | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    setError("");
    try {
      const [state, history] = await Promise.all([
        supabase.rpc("reported_content_state", { report_uuid: reportId }),
        supabase.from("content_moderation_events").select("id,action,reason,actor_name,created_at")
          .eq("target_type", targetType).eq("target_id", targetId)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10),
      ]);
      if (request !== version.current) return;
      if (state.error || history.error) throw new Error();
      setRemoved(state.data);
      setEvents(history.data || []);
    } catch {
      if (request === version.current) setError("Não foi possível consultar a moderação. Verifique a migração e tente atualizar.");
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [reportId, targetType, targetId]);
  useEffect(() => {
    void load();
    return () => { version.current++; };
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || removed === null || reason.trim().length < 10) return;
    if (!window.confirm(removed ? "Restaurar este conteúdo? As regras de acesso e a remoção do tópico pai continuam valendo." : "Remover este conteúdo da comunidade? A equipe poderá restaurá-lo depois.")) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const request = version.current;
    try {
      const { error: actionError } = await supabase.rpc("moderate_reported_content", {
        report_uuid: reportId, moderation_action: removed ? "restore" : "remove", moderation_reason: reason.trim(),
      });
      if (request !== version.current) return;
      if (actionError) {
        setError(actionError.code === "40001" ? "Outro moderador já alterou este conteúdo. Atualize antes de tentar novamente."
          : actionError.code === "P0002" ? "Conteúdo não encontrado ou excluído definitivamente."
          : "Não foi possível registrar a ação. Verifique seu acesso e o motivo informado.");
        return;
      }
      setSuccess(removed ? "Conteúdo restaurado. A ação foi registrada." : "Conteúdo removido de forma reversível. A ação foi registrada.");
      setReason("");
      await load();
    } catch {
      if (request === version.current) setError("Falha de conexão. Atualize para conferir o resultado antes de tentar novamente.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <section aria-label="Moderação do conteúdo" className="mt-5 space-y-3 rounded-xl border border-white/15 p-4">
    <h3 className="font-bold">Moderação do conteúdo</h3>
    {success && <p role="status" className="text-sm text-[#ffd19a]">{success}</p>}
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    <button type="button" disabled={busy || loading} onClick={() => void load()} className="text-sm underline disabled:opacity-50">Atualizar estado e histórico</button>
    {loading ? <p role="status">Consultando conteúdo…</p> : !error && <>
      <p className="text-sm text-[#b9aaa0]">{removed === null ? "Conteúdo excluído definitivamente ou indisponível. Não é possível restaurá-lo."
        : removed ? "Removido pela moderação; pode ser restaurado." : "Sem remoção individual. A visibilidade também depende do tópico e das permissões."}</p>
      {removed !== null && <form onSubmit={submit} className="space-y-3">
        <label htmlFor={field} className="block text-sm">Motivo da {removed ? "restauração" : "remoção"} (obrigatório)</label>
        <p className="text-xs text-[#b9aaa0]">Este motivo será enviado ao autor. Não inclua a identidade de quem denunciou nem informações internas.</p>
        <textarea id={field} required minLength={10} maxLength={2000} rows={3} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 p-3 outline-none focus:border-[#ff8a3d]" />
        <button disabled={busy || reason.trim().length < 10} className="rounded-full border border-[#ff8a3d]/60 px-4 py-2 text-[#ffd19a] disabled:opacity-50">{busy ? "Registrando…" : removed ? "Restaurar conteúdo" : "Remover conteúdo"}</button>
        <p className="text-xs text-[#b9aaa0]">Esta ação não encerra a denúncia. Após analisar, marque-a como resolvida ou descartada abaixo.</p>
      </form>}
      <details>
        <summary className="cursor-pointer text-sm">Histórico — últimas 10 ações</summary>
        {!events.length && <p className="mt-3 text-sm text-[#b9aaa0]">Nenhuma remoção ou restauração registrada.</p>}
        <ol className="mt-3 space-y-3">{events.map(item => <li key={item.id} className="rounded-lg bg-black/20 p-3 text-sm">
          <strong>{item.action === "remove" ? "Remoção" : "Restauração"} · {item.actor_name}</strong>
          <p className="text-xs text-[#b9aaa0]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{item.reason}</p>
        </li>)}</ol>
      </details>
    </>}
  </section>;
}
