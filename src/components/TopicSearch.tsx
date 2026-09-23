"use client";

import Link from "next/link";
import TopicStatus from "@/components/TopicStatus";
import { FormEvent, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Topic = {
  id: string; title: string; content: string; created_at: string;
  is_pinned: boolean; is_locked: boolean;
  author: { display_name: string | null; username: string | null } | null;
  category: { name: string } | null;
};
type Status = "idle" | "loading" | "ready" | "error" | "signed-out";
const fields = "id, title, content, created_at, is_pinned, is_locked, author:profiles!posts_author_id_fkey(display_name, username), category:forum_categories!posts_category_id_fkey(name)";

export default function TopicSearch() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<Topic[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [validation, setValidation] = useState("");
  const [more, setMore] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      request.current++;
      setResults([]); setSearched(""); setStatus("idle");
    });
    return () => { request.current++; data.subscription.unsubscribe(); };
  }, []);

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const term = query.trim();
    const version = ++request.current;
    setResults([]); setValidation(""); setMore(false);
    if (term.length < 2 || term.length > 120) {
      setStatus("idle"); setValidation("Digite de 2 a 120 caracteres para buscar."); return;
    }
    setSearched(term); setStatus("loading");
    try {
      if (!isSupabaseConfigured) throw new Error("Configuração indisponível");
      const auth = await supabase.auth.getUser();
      if (version !== request.current) return;
      if (!auth.data.user) {
        setStatus(auth.error && auth.error.name !== "AuthSessionMissingError" ? "error" : "signed-out"); return;
      }
      if (auth.error) throw auth.error;
      // Filtros separados evitam interpolar a entrada na sintaxe de filtros OR.
      // A consulta busca palavras em português, usando o parser websearch do PostgreSQL.
      const responses = await Promise.all(["title", "content"].map(column =>
        supabase.from("posts").select(fields)
          .textSearch(column, term, { config: "portuguese", type: "websearch" })
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(21)
      ));
      if (version !== request.current) return;
      if (responses.some(response => response.error)) throw new Error("Busca indisponível");
      const unique = new Map<string, Topic>();
      for (const response of responses) {
        for (const topic of response.data as unknown as Topic[]) unique.set(topic.id, topic);
      }
      const topics = [...unique.values()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      setMore(topics.length > 20); setResults(topics.slice(0, 20)); setStatus("ready");
    } catch {
      if (version === request.current) setStatus("error");
    }
  }

  function clear() {
    request.current++; setQuery(""); setSearched(""); setResults([]);
    setValidation(""); setStatus("idle"); setMore(false);
  }

  return <section aria-label="Busca de tópicos" className="w-full min-w-0 max-w-xl">
    <form role="search" onSubmit={search} className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="topic-search">Buscar tópicos por título ou conteúdo</label>
      <input id="topic-search" type="search" maxLength={120} value={query}
        onChange={event => {
          request.current++; setQuery(event.target.value); setResults([]);
          setStatus("idle"); setValidation("");
        }}
        aria-describedby="topic-search-help"
        placeholder="Buscar tópicos..."
        className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none focus:border-[#ff8a3d]" />
      <button type="submit" disabled={status === "loading"} className="rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e] disabled:opacity-50">{status === "loading" ? "Buscando..." : "Buscar"}</button>
      {query && <button type="button" onClick={clear} className="text-sm text-[#ffd19a] underline">Limpar</button>}
    </form>
    <p id="topic-search-help" className="mt-2 text-xs text-[#b9aaa0]">Busque palavras no título ou conteúdo dos tópicos.</p>
    <div aria-live="polite">
      {validation && <p className="mt-3 text-sm text-[#ffd19a]">{validation}</p>}
      {status === "loading" && <p className="mt-3 text-sm text-[#b9aaa0]">Consultando tópicos...</p>}
      {status === "signed-out" && <p className="mt-3 text-sm"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para pesquisar.</p>}
      {status === "error" && <div className="mt-3 text-sm text-red-200"><p>Não foi possível buscar os tópicos.</p><button type="button" onClick={() => void search()} className="mt-2 underline">Tentar novamente</button></div>}
      {status === "ready" && <div className="mt-3 rounded-xl border border-white/10 bg-[#181513] p-4">
        <h2 className="font-bold">Resultados para “{searched}”</h2>
        <p className="mt-1 text-xs text-[#b9aaa0]">{more ? "Exibindo os 20 mais recentes. Refine a busca para encontrar outros tópicos." : results.length + (results.length === 1 ? " tópico encontrado." : " tópicos encontrados.")}</p>
        {results.length ? <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto">
          {results.map(topic => <li key={topic.id} className="border-t border-white/10 pt-3">
            <TopicStatus pinned={topic.is_pinned} locked={topic.is_locked} />
            <Link href={"/foruns/topico/" + topic.id} className="break-words font-bold text-[#ffd19a] hover:underline">{topic.title}</Link>
            <p className="mt-1 break-words text-xs text-[#b9aaa0]">{topic.author?.display_name || topic.author?.username || "Usuário"} · {topic.category?.name || "Fórum"}</p>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-[#b9aaa0]">{topic.content}</p>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-[#b9aaa0]">Nenhum tópico disponível corresponde à busca. Tente outras palavras.</p>}
      </div>}
    </div>
  </section>;
}
