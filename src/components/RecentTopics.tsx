"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import PostCard from "@/components/PostCard";

type Topic = {
  id: string; title: string; content: string; created_at: string;
  is_pinned: boolean; is_locked: boolean;
  author: { display_name: string | null; username: string | null } | null;
  category: { name: string } | null;
};
type TopicWithCount = Topic & { commentCount: number };
type Status = "loading" | "ready" | "signed-out" | "error";

export default function RecentTopics() {
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const version = ++request.current;
      const current = () => active && version === request.current;
      setTopics([]);
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
        const result = await supabase.from("posts")
          .select("id, title, content, created_at, is_pinned, is_locked, author:profiles!posts_author_id_fkey(display_name, username), category:forum_categories!posts_category_id_fkey(name)")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(3);
        if (!current()) return;
        if (result.error) throw result.error;
        const recent = result.data as unknown as Topic[];
        // Consultas de contagem não transferem o histórico de comentários e respeitam RLS.
        const counted = await Promise.all(recent.map(async topic => {
          const countResult = await supabase.from("comments")
            .select("id", { count: "exact", head: true }).eq("post_id", topic.id);
          if (countResult.error || countResult.count === null) throw new Error("Contagem indisponível");
          return { ...topic, commentCount: countResult.count };
        }));
        if (!current()) return;
        setTopics(counted);
        setStatus("ready");
      } catch {
        if (current()) setStatus("error");
      }
    }
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      request.current++;
      setTopics([]);
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

  return <section aria-label="Tópicos recentes" className="min-w-0">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-xl font-bold">Tópicos recentes</h3>
      <Link href="/foruns" className="text-sm text-[#ffd19a] hover:underline">Ver todos</Link>
    </div>
    <div aria-live="polite" className="space-y-3">
      {status === "loading" && <p className="py-4 text-sm text-[#b9aaa0]">Carregando tópicos...</p>}
      {status === "signed-out" && <p className="py-4 text-sm text-[#b9aaa0]"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para ver os tópicos.</p>}
      {status === "error" && <div className="py-4 text-sm text-red-200"><p>Não foi possível carregar os tópicos e suas contagens.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">Tentar novamente</button></div>}
      {status === "ready" && (topics.length ? topics.map(topic =>
        <PostCard key={topic.id} href={"/foruns/topico/" + topic.id}
          name={topic.author?.display_name || topic.author?.username || "Usuário"}
          title={topic.title} text={topic.content} pinned={topic.is_pinned} locked={topic.is_locked}
          tags={[topic.category?.name || "Fórum"]}
          meta={topic.commentCount + (topic.commentCount === 1 ? " comentário" : " comentários") + " · " + new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(topic.created_at))} />
      ) : <p className="rounded-xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">Nenhum tópico disponível para você no momento.</p>)}
    </div>
  </section>;
}
