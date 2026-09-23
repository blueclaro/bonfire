"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import { schoolDayRange } from "@/lib/schoolDay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Counts = { posts: number; comments: number; rooms: number };
type Status = "loading" | "ready" | "signed-out" | "error";

export default function TodayStats() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let version = 0;
    async function refresh() {
      const current = ++version;
      const valid = () => active && version === current;
      setCounts(null); setStatus("loading");
      try {
        if (!isSupabaseConfigured) throw new Error("Configuração indisponível");
        const auth = await supabase.auth.getUser();
        if (!valid()) return;
        if (!auth.data.user) {
          setStatus(auth.error && auth.error.name !== "AuthSessionMissingError" ? "error" : "signed-out");
          return;
        }
        if (auth.error) throw auth.error;
        const { start, end } = schoolDayRange();
        // head evita transferir registros; RLS limita todas as contagens.
        const results = await Promise.all([
          supabase.from("posts").select("id", { count: "exact", head: true })
            .gte("created_at", start).lt("created_at", end),
          supabase.from("comments").select("id", { count: "exact", head: true })
            .gte("created_at", start).lt("created_at", end),
          supabase.from("chat_rooms").select("id", { count: "exact", head: true }),
        ]);
        if (!valid()) return;
        if (results.some(result => result.error || result.count === null)) throw new Error("Contagens indisponíveis");
        setCounts({ posts: results[0].count!, comments: results[1].count!, rooms: results[2].count! });
        setStatus("ready");
      } catch {
        if (valid()) { setCounts(null); setStatus("error"); }
      }
    }
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    // Recalcula também a janela de datas quando a página atravessa a meia-noite.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange(() => {
      version++; setCounts(null); setStatus("loading");
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => {
      active = false; version++;
      clearInterval(interval); clearTimeout(timer);
      window.removeEventListener("focus", focus);
      data.subscription.unsubscribe();
    };
  }, [retry]);

  const format = (count: number) => new Intl.NumberFormat("pt-BR").format(count);
  return <section aria-label="Resumo de hoje">
    <h3 className="text-xl font-bold">Hoje</h3>
    <p className="mt-1 text-xs text-[#b9aaa0]">
      <time dateTime={now?.toISOString()} aria-label="Hora atual em São Paulo" className="tabular-nums">
        {now ? new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).format(now) : "--:--:--"}
      </time> · Conteúdo disponível para você
    </p>
    <div aria-live="polite">
      {status === "loading" && <p className="py-4 text-sm text-[#b9aaa0]">Carregando indicadores...</p>}
      {status === "signed-out" && <p className="py-4 text-sm text-[#b9aaa0]"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para ver os indicadores.</p>}
      {status === "error" && <div className="py-4 text-sm text-red-200"><p>Não foi possível carregar os indicadores.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">Tentar novamente</button></div>}
      {status === "ready" && counts && <>
        <StatCard label="Tópicos de hoje" value={format(counts.posts)} />
        <StatCard label="Comentários de hoje" value={format(counts.comments)} />
        <StatCard label="Salas disponíveis" value={format(counts.rooms)} />
      </>}
    </div>
  </section>;
}
