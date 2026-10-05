"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "approved" | "rejected";
type Account = {
  id: string; username: string | null; display_name: string | null; role: string;
  class_name: string | null; created_at: string; temporary_expires_at: string | null;
  email: string | null; email_verified: boolean; approval_status: Status;
  approval_reason: string | null; approval_reviewed_at: string | null; reviewer_name: string | null;
};
const labels: Record<Status, string> = { pending: "Pendentes", approved: "Aprovadas", rejected: "Rejeitadas" };
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

export default function AccountModerationPanel() {
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const version = useRef(0);
  const saving = useRef(false);
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true); setError(""); setAccounts([]);
    try {
      const { data, error: queryError } = await supabase.rpc("account_review_queue", { queue_status: status, page_offset: page * 20 });
      if (request !== version.current) return;
      if (queryError) throw queryError;
      setAccounts((data || []).slice(0, 20)); setHasMore((data || []).length > 20);
    } catch {
      if (request === version.current) setError("Não foi possível carregar as contas. Verifique seu acesso e se a migração de aprovação foi aplicada.");
    } finally { if (request === version.current) setLoading(false); }
  }, [status, page]);
  useEffect(() => {
    void load();
    return () => { version.current++; };
  }, [load]);

  async function review(account: Account, decision: "approved" | "rejected") {
    if (saving.current) return;
    const reason = (reasons[account.id] || "").trim();
    if (decision === "rejected" && reason.length < 10) { setError("Informe um motivo de pelo menos 10 caracteres para rejeitar o cadastro."); return; }
    saving.current = true; setBusy(account.id); setError(""); setNotice("");
    const request = version.current;
    try {
      const { error: reviewError } = await supabase.rpc("review_account", { account_uuid: account.id, decision, review_reason: reason });
      if (request !== version.current) return;
      if (reviewError) {
        setError(reviewError.code === "P0002" ? "Esta conta já foi analisada. Atualize a lista." : reviewError.code === "22023" ? reviewError.message : "Não foi possível registrar a decisão. Verifique seu acesso e tente novamente.");
        return;
      }
      setNotice(decision === "approved" ? "Conta aprovada. O acesso ao Bonfire foi liberado." : "Cadastro rejeitado. O motivo ficará visível para o usuário.");
      setReasons(current => { const next = { ...current }; delete next[account.id]; return next; });
      await load();
    } catch { if (request === version.current) setError("Falha de conexão. Atualize a lista antes de tentar novamente."); }
    finally { saving.current = false; setBusy(""); }
  }

  return <div>
    <p className="mt-5 text-[#b9aaa0]">Confira a identidade do usuário antes de liberar o acesso. Contas permanentes precisam confirmar o e-mail primeiro.</p>
    <div className="my-6 flex flex-wrap items-center gap-3">
      <label htmlFor="account-status">Situação</label>
      <select id="account-status" disabled={!!busy} value={status} onChange={event => { setStatus(event.target.value as Status); setPage(0); setNotice(""); }} className="rounded-lg border border-white/20 bg-[#211b17] p-3">
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button disabled={loading || !!busy} onClick={() => void load()} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">Atualizar</button>
    </div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-300/30 p-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-5 text-[#ffd19a]">{notice}</p>}
    {loading ? <p role="status">Carregando contas…</p> : <>
      {!accounts.length && !error && <p className="rounded-xl border border-dashed border-white/20 p-6 text-[#b9aaa0]">Nenhuma conta nesta página.</p>}
      <div className="space-y-5">{accounts.map(account => {
        const expired = !!account.temporary_expires_at && new Date(account.temporary_expires_at).getTime() <= Date.now();
        const ready = !expired && (!!account.temporary_expires_at || account.email_verified);
        return <article key={account.id} className="rounded-xl border border-white/10 bg-white/[.035] p-5">
          <div className="flex flex-wrap justify-between gap-2"><h2 className="break-words font-bold">{account.display_name || account.username || "Sem nome"}</h2><time className="text-sm text-[#b9aaa0]">{date(account.created_at)}</time></div>
          <p className="mt-2 break-words text-[#ffd19a]">@{account.username} · {account.temporary_expires_at ? "Conta temporária" : "Conta permanente"}</p>
          {account.email && <p className="mt-2 break-all">{account.email}</p>}
          {account.class_name && <p className="mt-2 text-sm text-[#b9aaa0]">Turma: {account.class_name}</p>}
          <p className="mt-2 text-sm text-[#b9aaa0]">{account.temporary_expires_at ? `Validade: ${date(account.temporary_expires_at)}${expired ? " (expirada)" : ""}` : account.email_verified ? "E-mail confirmado" : "Aguardando confirmação do e-mail"}</p>
          {account.approval_status === "pending" ? <>
            <label htmlFor={`reason-${account.id}`} className="mt-5 block text-sm text-[#b9aaa0]">Motivo da decisão (obrigatório ao rejeitar)</label>
            <textarea id={`reason-${account.id}`} maxLength={2000} disabled={!!busy} value={reasons[account.id] || ""} onChange={event => setReasons(current => ({ ...current, [account.id]: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/20 bg-black/20 p-3" />
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={!!busy || !ready} onClick={() => void review(account, "approved")} className="rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e] disabled:opacity-50">{busy === account.id ? "Salvando…" : "Aprovar conta"}</button>
              <button disabled={!!busy} onClick={() => void review(account, "rejected")} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">Rejeitar cadastro</button>
            </div>
          </> : <div className="mt-4 text-sm text-[#b9aaa0]">
            <p>{labels[account.approval_status]} · {account.approval_reviewed_at ? date(account.approval_reviewed_at) : "Conta anterior à verificação"}{account.reviewer_name && ` · ${account.reviewer_name}`}</p>
            {account.approval_reason && <p className="mt-2 whitespace-pre-wrap break-words">Motivo: {account.approval_reason}</p>}
          </div>}
        </article>;
      })}</div>
      <div className="mt-6 flex items-center gap-4">
        <button disabled={page === 0 || !!busy} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Anterior</button>
        <span>Página {page + 1}</span>
        <button disabled={!hasMore || !!busy} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Próxima</button>
      </div>
    </>}
  </div>;
}
