"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ReportedContentActions from "@/components/ReportedContentActions";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "resolved" | "dismissed";
type Report = {
  id: string; target_type: string; target_id: string; reason: string; created_at: string;
  target_excerpt: string | null; target_path: string | null;
  reviewed_at: string | null; reviewed_by: string | null; status: Status;
};
const statuses: Record<Status, string> = { pending: "Pendentes", resolved: "Resolvidas", dismissed: "Descartadas" };
const kinds: Record<string, string> = { post: "Tópico", comment: "Comentário", message: "Mensagem" };
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const pageSize = 20;

export default function ReportsPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const version = useRef(0);
  const saving = useRef(false);

  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    setError("");
    setReports([]);
    setAllowed(false);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (request !== version.current) return;
      if (authError || !user) {
        setError("Entre na sua conta para acessar esta área.");
        return;
      }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (request !== version.current) return;
      if (profileError) throw profileError;
      if (!["moderator", "coordination"].includes(profile?.role || "")) {
        setError("Área restrita à coordenação e aos moderadores.");
        return;
      }
      const { data, error: queryError } = await supabase.from("reports")
        .select("id,target_type,target_id,reason,created_at,target_excerpt,target_path,reviewed_at,reviewed_by,status")
        .eq("status", status).order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize);
      if (request !== version.current) return;
      if (queryError) throw queryError;
      setAllowed(true);
      setReports((data || []).slice(0, pageSize) as Report[]);
      setHasMore((data || []).length > pageSize);
    } catch {
      if (request === version.current) setError("Não foi possível carregar as denúncias. Verifique se a migração foi aplicada e tente novamente.");
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setNotice(""); void load(); });
    return () => { version.current++; subscription.unsubscribe(); };
  }, [load]);

  async function review(reportId: string, resolution: "resolved" | "dismissed") {
    if (saving.current) return;
    if (!window.confirm(resolution === "resolved" ? "Marcar como resolvida? Isso encerra a denúncia, sem remover o conteúdo." : "Descartar esta denúncia após análise?")) return;
    saving.current = true;
    setBusy(reportId);
    setError("");
    setNotice("");
    const request = version.current;
    try {
      const { error: reviewError } = await supabase.rpc("review_report", { report_uuid: reportId, resolution });
      if (request !== version.current) return;
      if (reviewError) {
        setError(reviewError.code === "P0002" ? "Esta denúncia já foi analisada ou removida. Atualize a lista." : "Não foi possível salvar a decisão. Verifique seu acesso e tente novamente.");
        return;
      }
      setNotice("Decisão registrada. O conteúdo não foi alterado.");
      await load();
    } catch {
      if (request === version.current) setError("Falha de conexão. Atualize a lista antes de tentar novamente.");
    } finally {
      saving.current = false;
      setBusy("");
    }
  }

  return <main className="min-h-screen bg-[#100f0e] text-[#f6efe7] app-shell xl:grid xl:grid-cols-[260px_1fr]">
    <Sidebar active="denuncias" showRooms={false} />
    <section className="mx-auto w-full max-w-5xl p-5 md:p-10">
      <h1 className="text-3xl font-black">Denúncias</h1>
      <p className="mt-3 text-[#b9aaa0]">Fila privada da coordenação e dos moderadores. Analise o motivo e o conteúdo antes de registrar sua decisão.</p>
      <div className="my-6 flex flex-wrap items-center gap-3">
        <label htmlFor="report-status">Situação</label>
        <select id="report-status" value={status} disabled={!!busy} onChange={e => { setStatus(e.target.value as Status); setPage(0); setNotice(""); }} className="rounded-lg border border-white/20 bg-[#211b17] p-3">
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button disabled={loading || !!busy} onClick={() => void load()} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">Atualizar</button>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-300/30 p-4 text-red-200">{error}</p>}
      {notice && <p role="status" className="mb-5 text-[#ffd19a]">{notice}</p>}
      {loading ? <p role="status">Carregando denúncias…</p> : allowed && <>
        {!reports.length && <p className="rounded-xl border border-dashed border-white/20 p-6 text-[#b9aaa0]">Nenhuma denúncia nesta página.</p>}
        <div className="space-y-5">{reports.map(report => <article key={report.id} className="rounded-xl border border-white/10 bg-white/[.035] p-5">
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{kinds[report.target_type] || "Conteúdo"} denunciado</h2><time className="text-sm text-[#b9aaa0]">{date(report.created_at)}</time></div>
          <h3 className="mt-5 text-sm font-bold text-[#ffd19a]">Motivo</h3>
          <p className="mt-2 whitespace-pre-wrap break-words">{report.reason}</p>
          <h3 className="mt-5 text-sm font-bold text-[#ffd19a]">Trecho no momento da denúncia (até 2000 caracteres)</h3>
          <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/20 p-4 text-[#d2c5bb]">{report.target_excerpt || "Trecho não disponível para esta denúncia antiga."}</blockquote>
          {report.target_path && /^\/(foruns\/topico\/[0-9a-f-]+|chats)$/.test(report.target_path) && <Link href={report.target_path} className="mt-3 inline-block text-sm text-[#ffd19a] underline">{report.target_type === "message" ? "Abrir chats" : "Abrir tópico"}</Link>}
          <p className="mt-2 text-xs text-[#b9aaa0]">O conteúdo original pode ter sido editado ou removido. Encerrar a denúncia não exclui o conteúdo.</p>
          <ReportedContentActions reportId={report.id} targetType={report.target_type} targetId={report.target_id} />
          {report.status === "pending" ? <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={!!busy} onClick={() => void review(report.id, "resolved")} className="rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e] disabled:opacity-50">{busy === report.id ? "Salvando…" : "Marcar como resolvida"}</button>
            <button disabled={!!busy} onClick={() => void review(report.id, "dismissed")} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">Descartar</button>
          </div> : <p className="mt-4 break-all text-xs text-[#b9aaa0]">Analisada {report.reviewed_at ? date(report.reviewed_at) : ""} · Responsável: {report.reviewed_by || "indisponível"}</p>}
        </article>)}</div>
        <div className="mt-6 flex items-center gap-4">
          <button disabled={page === 0 || !!busy} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Anterior</button>
          <span>Página {page + 1}</span>
          <button disabled={!hasMore || !!busy} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Próxima</button>
        </div>
      </>}
    </section>
  </main>;
}
