"use client";

import Sidebar from "@/components/Sidebar";
import TopicStatus from "@/components/TopicStatus";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; description: string | null };
type Post = { id: string; title: string; created_at: string; is_pinned: boolean; is_locked: boolean };

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let version = 0;
    setCategory(null); setPosts([]); setLoading(true);
    async function load() {
      const current = ++version;
      try {
        const [categoryResult, postsResult] = await Promise.all([
          supabase.from("forum_categories").select("id, name, description").eq("id", categoryId).maybeSingle(),
          supabase.from("posts").select("id, title, created_at, is_pinned, is_locked")
            .eq("category_id", categoryId)
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false }).order("id", { ascending: false }),
        ]);
        if (!active || current !== version) return;
        if (categoryResult.error || postsResult.error) throw new Error("Não foi possível carregar os tópicos.");
        setCategory(categoryResult.data);
        setPosts(postsResult.data ?? []); setError("");
      } catch {
        if (active && current === version) {
          setCategory(null); setPosts([]); setError("Não foi possível carregar a categoria. Tente novamente.");
        }
      } finally {
        if (active && current === version) setLoading(false);
      }
    }
    if (categoryId) void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const interval = setInterval(refresh, 30000);
    const channel = supabase.channel("category-posts:" + categoryId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts", filter: "category_id=eq." + categoryId }, refresh)
      .subscribe();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      version++; setCategory(null); setPosts([]); setLoading(true);
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void load(); }, 0);
    });
    return () => {
      active = false; version++;
      clearInterval(interval); clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      data.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [categoryId, retry]);

  return <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
    <section className="app-shell grid min-h-screen xl:grid-cols-[260px_1fr]">
      <Sidebar active="foruns" />
      <section className="p-4 md:p-8">
        <Link href="/foruns" className="text-sm text-[#ffd19a]">← Voltar aos fóruns</Link>
        {loading ? <p role="status" className="mt-8 text-[#b9aaa0]">Carregando tópicos...</p> :
          error ? <div role="alert" className="mt-8 text-red-200">{error}<button onClick={() => setRetry(value => value + 1)} className="ml-3 underline">Tentar novamente</button></div> :
          !category ? <p className="mt-8 text-red-200">Categoria não encontrada ou acesso indisponível.</p> : <>
            <h1 className="mt-6 text-4xl font-black">{category.name}</h1>
            <p className="mt-3 text-[#b9aaa0]">{category.description}</p>
            <div className="mt-8 grid gap-3">
              {posts.length ? posts.map(post => <Link key={post.id} href={"/foruns/topico/" + post.id} className={"rounded-xl border bg-white/[.045] p-5 hover:border-[#ff8a3d]/40 " + (post.is_pinned ? "border-[#ff8a3d]/30" : "border-white/10")}>
                <TopicStatus pinned={post.is_pinned} locked={post.is_locked} />
                <h2 className="break-words text-xl font-bold">{post.title}</h2>
                <p className="mt-3 font-semibold text-[#ffd19a]">{post.is_locked ? "Abrir tópico e ver comentários →" : "Abrir tópico e comentar →"}</p>
                <p className="mt-2 text-sm text-[#b9aaa0]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.created_at))}</p>
              </Link>) : <div className="rounded-xl border border-dashed border-white/10 p-7 text-[#b9aaa0]">Ainda não existem tópicos nesta categoria.</div>}
            </div>
          </>}
      </section>
    </section>
  </main>;
}
