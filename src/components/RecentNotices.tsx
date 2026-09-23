"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import NoticePreview from "@/components/NoticePreview";

type Notice = { id: string; title: string; content: string; created_at: string };
type Status = "loading" | "ready" | "signed-out" | "error";

export default function RecentNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const version = ++request.current;
      const current = () => active && version === request.current;
      setNotices([]);
      setStatus("loading");
      try {
        if (!isSupabaseConfigured) throw new Error("Configuração indisponível");
        const auth = await supabase.auth.getUser();
        if (!current()) return;
        if (!auth.data.user) {
          setStatus(auth.error && auth.error.name !== "AuthSessionMissingError" ? "error" : "signed-out");
          return;
        }
        if (auth.error) throw auth.error;
        // A mesma política RLS da página de avisos determina o público autorizado.
        const result = await supabase.from("announcements")
          .select("id, title, content, created_at")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(3);
        if (!current()) return;
        if (result.error) throw result.error;
        setNotices(result.data ?? []);
        setStatus("ready");
      } catch {
        if (current()) setStatus("error");
      }
    }
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    // Adia chamadas ao SDK para fora do callback de autenticação.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      request.current++;
      setNotices([]);
      setStatus("loading");
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => {
      active = false;
      request.current++;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [retry]);

  return <section aria-label="Avisos recentes" className="mt-8">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xl font-bold">Avisos recentes</h3>
      <Link href="/avisos" className="text-sm text-[#ffd19a] hover:underline">Ver todos</Link>
    </div>
    <div aria-live="polite">
      {status === "loading" && <p className="py-4 text-sm text-[#b9aaa0]">Carregando avisos...</p>}
      {status === "signed-out" && <p className="py-4 text-sm text-[#b9aaa0]"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para ver os avisos.</p>}
      {status === "error" && <div className="py-4 text-sm text-red-200"><p>Não foi possível carregar os avisos.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">Tentar novamente</button></div>}
      {status === "ready" && (notices.length ? notices.map(notice =>
        <NoticePreview key={notice.id} title={notice.title} text={notice.content} href={"/avisos#aviso-" + notice.id} createdAt={notice.created_at} />
      ) : <p className="py-4 text-sm text-[#b9aaa0]">Nenhum aviso disponível para você no momento.</p>)}
    </div>
  </section>;
}
