"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useNotifications } from "@/lib/useNotifications";
import { supabase } from "@/lib/supabase";

export default function NotificationsPage() {
  const [page, setPage] = useState(0);
  const { userId, authReady, loading, items, count, error, hasMore, refresh } = useNotifications(true, page);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const saving = useRef(false);
  const currentUser = useRef(userId);
  currentUser.current = userId;

  async function markRead(id: string) {
    if (saving.current) return;
    saving.current = true;
    const owner = userId;
    setBusy(id); setActionError("");
    try {
      const { error: readError } = await supabase.rpc("mark_notification_read", { notification_uuid: id });
      if (currentUser.current !== owner) return;
      if (readError) throw readError;
      window.dispatchEvent(new Event("bonfire:notifications-read"));
      refresh();
    } catch {
      if (currentUser.current === owner) setActionError("Não foi possível marcar como lida. Tente novamente.");
    } finally { saving.current = false; setBusy(""); }
  }

  return <main className="min-h-screen bg-[#100f0e] text-[#f6efe7] xl:grid xl:grid-cols-[260px_1fr]">
    <Sidebar active="notificacoes" showRooms={false} />
    <section className="mx-auto w-full max-w-4xl p-5 md:p-10">
      <h1 className="text-3xl font-black">Notificações</h1>
      <p className="mt-3 text-[#b9aaa0]">Comentários nos seus tópicos e decisões da moderação sobre seus conteúdos.</p>
      {authReady && !userId ? <p className="mt-6"><Link className="text-[#ffd19a] underline" href="/login">Entre na sua conta</Link> para consultar suas notificações.</p> : <>
        <div className="my-6 flex items-center gap-4">
          <p aria-live="polite">{count === null ? "Contador indisponível" : `${count} não lida${count === 1 ? "" : "s"}`}</p>
          <button disabled={!!busy} onClick={refresh} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">Atualizar</button>
        </div>
        {(error || actionError) && <p role="alert" className="mb-5 text-red-200">{error || actionError}</p>}
        {loading ? <p role="status">Carregando notificações…</p> : !error && <>
          {!items.length && <p className="rounded-xl border border-dashed border-white/20 p-6 text-[#b9aaa0]">Nenhuma notificação nesta página. Novas atividades aparecerão aqui.</p>}
          <div className="space-y-4">{items.map(item => <article key={item.id} className={`rounded-xl border p-5 ${item.read_at ? "border-white/10 bg-white/[.025]" : "border-[#ff8a3d]/40 bg-white/[.05]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">{item.message}</h2>
              {!item.read_at && <span className="text-xs text-[#ffd19a]">Não lida</span>}
            </div>
            <time className="mt-2 block text-xs text-[#b9aaa0]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</time>
            {item.reason && <div className="mt-4"><h3 className="text-sm font-bold text-[#ffd19a]">Motivo informado pela moderação</h3><p className="mt-2 whitespace-pre-wrap break-words">{item.reason}</p></div>}
            {item.kind !== "comment" && <p className="mt-3 text-xs text-[#b9aaa0]">A restauração respeita as permissões e a situação do tópico. Conteúdos removidos não podem ser abertos.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {/^\/(foruns\/topico\/[0-9a-f-]+|chats)$/.test(item.destination) && <Link href={item.destination} className="text-sm text-[#ffd19a] underline">{item.destination === "/chats" ? "Abrir chats" : "Abrir tópico"}</Link>}
              {!item.read_at && <button disabled={!!busy} onClick={() => void markRead(item.id)} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50">{busy === item.id ? "Salvando…" : "Marcar como lida"}</button>}
            </div>
          </article>)}</div>
          <div className="mt-6 flex items-center gap-4">
            <button disabled={!page || !!busy} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Anterior</button>
            <span>Página {page + 1}</span>
            <button disabled={!hasMore || !!busy} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-white/20 p-3 disabled:opacity-40">Próxima</button>
          </div>
        </>}
      </>}
    </section>
  </main>;
}
