"use client";

import Sidebar from "@/components/Sidebar";
import TopicActions from "@/components/TopicActions";
import TopicModeration from "@/components/TopicModeration";
import ReportButton from "@/components/ReportButton";
import TopicStatus from "@/components/TopicStatus";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Author = {
  display_name: string | null;
  username: string | null;
  role: string;
};

type Post = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  category_id: string;
  author_id: string;
  is_locked: boolean;
  is_pinned: boolean;
  author: Author | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: Author | null;
};

const roleLabels: Record<string, string> = {
  student: "Aluno",
  teacher: "Professor",
  coordination: "Coordenação",
  moderator: "Moderador",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function authorName(author: Author | null) {
  return author?.display_name || author?.username || "Usuário";
}

export default function TopicPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [commentActionId, setCommentActionId] = useState("");

  const loadComments = useCallback(async () => {
    if (!postId) return;

    setCommentsLoading(true);

    const { data: commentData, error } = await supabase
      .from("comments")
      .select("id, content, created_at, updated_at, author_id")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Não foi possível carregar os comentários: ${error.message}`);
      setCommentsLoading(false);
      return;
    }

    const authorIds = [...new Set((commentData ?? []).map((comment) => comment.author_id))];
    const { data: profiles, error: profilesError } = authorIds.length
      ? await supabase.from("profiles").select("id, display_name, username, role").in("id", authorIds)
      : { data: [], error: null };

    if (profilesError) {
      setMessage(`Não foi possível carregar os autores: ${profilesError.message}`);
    }
    const authors = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    setComments((commentData ?? []).map((comment) => ({
      ...comment,
      author: authors.get(comment.author_id) ?? null,
    })));
    setCommentsLoading(false);
  }, [postId]);

  useEffect(() => {
    let active = true;
    let version = 0;
    setPost(null);
    setLoading(true);
    setCurrentRole("");
    setContent("");
    async function loadTopic() {
      const current = ++version;
      const valid = () => active && current === version;
      try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (!valid()) return;
      if (authError || !userData.user) {
        setPost(null); setCurrentRole(""); setCurrentUserId("");
        router.replace("/login");
        return;
      }
      setCurrentUserId(userData.user.id);
      const { data: viewer, error: viewerError } = await supabase.from("profiles")
        .select("role").eq("id", userData.user.id).single();
      if (!valid()) return;
      setCurrentRole(viewerError ? "" : viewer?.role ?? "");
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id, title, content, created_at, updated_at, category_id, author_id, is_locked, is_pinned")
        .eq("id", postId)
        .single();

      if (!valid()) return;
      if (postData) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, username, role")
          .eq("id", postData.author_id)
          .single();
        if (!valid()) return;
        setPost({ ...postData, author: profileData });
        if (profileError) setMessage(`Não foi possível carregar o autor: ${profileError.message}`);
      } else if (postError && postError.code !== "PGRST116") {
        setMessage(`Não foi possível carregar o tópico: ${postError.message}`);
      } else {
        setPost(null);
      }

      await loadComments();
      } catch {
        if (valid()) setMessage("Não foi possível atualizar o tópico. Tente recarregar a página.");
      } finally {
        if (valid()) setLoading(false);
      }
    }

    if (postId) void loadTopic();
    const refresh = () => { if (document.visibilityState === "visible") void loadTopic(); };
    window.addEventListener("focus", refresh);
    const interval = setInterval(refresh, 30000);
    const channel = supabase.channel("topic-state:" + postId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts", filter: "id=eq." + postId }, refresh)
      .subscribe();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: authListener } = supabase.auth.onAuthStateChange(event => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      version++;
      setPost(null); setCurrentRole(""); setCurrentUserId(""); setContent("");
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void loadTopic(); }, 0);
    });
    return () => {
      active = false; version++;
      clearInterval(interval); clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [postId, loadComments, router]);

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => loadComments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, loadComments]);

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanContent = content.trim();
    if (!postId || !post || post.is_locked) {
      setMessage("Este tópico está fechado para novos comentários.");
      return;
    }
    if (cleanContent.length < 2 || cleanContent.length > 2000) {
      setMessage("O comentário deve ter entre 2 e 2000 caracteres.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      router.push("/login");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: userData.user.id,
      content: cleanContent,
    });
    setSending(false);

    if (error) {
      setMessage(`Não foi possível comentar: ${error.message}`);
      return;
    }

    setContent("");
    await loadComments();
  }

  async function handleEditComment(event: FormEvent<HTMLFormElement>, commentId: string) {
    event.preventDefault();
    const cleanContent = editContent.trim();
    if (cleanContent.length < 2 || cleanContent.length > 2000) {
      setMessage("O comentário deve ter entre 2 e 2000 caracteres.");
      return;
    }

    setCommentActionId(commentId);
    const { data, error } = await supabase.from("comments").update({ content: cleanContent, updated_at: new Date().toISOString() }).eq("id", commentId).select("id").maybeSingle();
    setCommentActionId("");
    if (error) {
      setMessage(`Não foi possível editar o comentário: ${error.message}`);
      return;
    }
    if (!data) { setMessage("O comentário foi removido ou seu acesso mudou. Atualize a página."); return; }
    setEditingCommentId("");
    setEditContent("");
    await loadComments();
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("Excluir este comentário? Esta ação não pode ser desfeita.")) return;
    setMessage("");
    setCommentActionId(commentId);
    const { data, error } = await supabase.from("comments").delete().eq("id", commentId).select("id").maybeSingle();
    setCommentActionId("");
    if (error) {
      setMessage(`Não foi possível excluir o comentário: ${error.message}`);
      return;
    }
    if (!data) { setMessage("O comentário foi removido ou seu acesso mudou. Atualize a página."); return; }
    await loadComments();
  }

  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="app-shell grid min-h-screen xl:grid-cols-[260px_1fr]">
        <Sidebar active="foruns" />
        <section className="p-4 md:p-8">
          {loading ? (
            <p className="text-[#b9aaa0]">Carregando tópico...</p>
          ) : !post ? (
            <>
              <Link href="/foruns" className="text-sm text-[#ffd19a]">← Voltar aos fóruns</Link>
              <p className="mt-8 text-red-200">Tópico não encontrado ou acesso indisponível.</p>
              {message && <p role="alert" className="mt-4 text-red-200">{message}</p>}
            </>
          ) : (
            <>
              <Link href={`/foruns/${post.category_id}`} className="text-sm text-[#ffd19a]">← Voltar à categoria</Link>
              <a href="#novo-comentario" className="mt-4 block w-fit rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">{post.is_locked ? "Ver comentários · tópico fechado" : "Comentar neste tópico"}</a>

              <article className="mt-6 rounded-2xl border border-white/10 bg-white/[.045] p-6 md:p-8">
                <TopicStatus pinned={post.is_pinned} locked={post.is_locked} />
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ff8a3d] font-black text-[#21140e]">{authorName(post.author).charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{authorName(post.author)}</strong>
                    <p className="text-sm text-[#7d7068]">@{post.author?.username || "usuário"} · {roleLabels[post.author?.role || ""] || "Membro"} · {formatDate(post.created_at)}</p>
                  </div>
                </div>
                <h1 className="mt-7 text-3xl font-black md:text-5xl">{post.title}</h1>
                <p className="mt-7 whitespace-pre-wrap leading-8 text-[#d2c5bb]">{post.content}</p>
                {post.updated_at !== post.created_at && <p className="mt-3 text-xs text-[#b9aaa0]">Editado em {formatDate(post.updated_at)}</p>}
                {post.author_id === currentUserId && <TopicActions key={post.id + ":" + currentUserId} post={post} onSaved={changes => {
                  setPost(current => current?.id === post.id ? { ...current, ...changes } : current);
                }} />}
                {["coordination", "moderator"].includes(currentRole) && <TopicModeration key={"moderation:" + post.id + ":" + currentUserId} postId={post.id} flags={post} onChanged={flags => {
                  setPost(current => current?.id === post.id ? { ...current, ...flags } : current);
                }} />}
                {currentUserId && post.author_id !== currentUserId && <ReportButton key={post.id + currentUserId} targetType="post" targetId={post.id} />}
              </article>

              <section className="mt-8">
                <h2 className="text-2xl font-black">Comentários <span className="text-[#ffd19a]">{comments.length}</span></h2>

                <form id="novo-comentario" aria-label="Publicar comentário" onSubmit={handleComment} className="mt-5 scroll-mt-4 rounded-xl border border-[#ff8a3d]/30 bg-white/[.035] p-5">
                  <label htmlFor="comment-content" className="mb-3 block font-bold">Escreva sua resposta</label>
                  {post.is_locked && <p className="mb-4 text-sm text-[#ffd19a]">Este tópico está fechado para novos comentários.</p>}
                  <textarea id="comment-content" aria-label="Comentário" required minLength={2} value={content} onChange={(event) => setContent(event.target.value)} disabled={post.is_locked || sending} maxLength={2000} rows={4} placeholder="Escreva um comentário..." className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d] disabled:cursor-not-allowed disabled:opacity-50" />
                  <div className="mt-2 flex items-center justify-between gap-4"><span className="text-xs text-[#7d7068]">{content.length}/2000</span><button type="submit" disabled={post.is_locked || sending || content.trim().length < 2} className="rounded-full bg-[#ff8a3d] px-5 py-2.5 font-bold text-[#21140e] disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Enviando..." : "Comentar"}</button></div>
                  {message && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</p>}
                </form>

                <div className="mt-5 grid gap-3">
                  {commentsLoading ? <div className="rounded-xl border border-white/10 p-6 text-[#b9aaa0]">Carregando comentários...</div> : comments.length ? comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-white/10 bg-white/[.045] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-[#ffd19a]">{authorName(comment.author).charAt(0).toUpperCase()}</div><div><strong>{authorName(comment.author)}</strong><p className="text-xs text-[#7d7068]">@{comment.author?.username || "usuário"} · {roleLabels[comment.author?.role || ""] || "Membro"} · {formatDate(comment.created_at)}{comment.updated_at !== comment.created_at ? " · editado" : ""}</p></div></div>{comment.author_id === currentUserId && <div className="flex gap-3 text-xs"><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditContent(comment.content); setMessage(""); }} className="text-[#ffd19a] hover:underline">Editar</button><button type="button" disabled={commentActionId === comment.id} onClick={() => handleDeleteComment(comment.id)} className="text-red-300 hover:underline disabled:opacity-50">Excluir</button></div>}</div>
                      {editingCommentId === comment.id ? <form onSubmit={(event) => handleEditComment(event, comment.id)} className="mt-4"><textarea required minLength={2} maxLength={2000} rows={4} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"/><div className="mt-2 flex justify-end gap-3"><button type="button" onClick={() => setEditingCommentId("")} className="rounded-full border border-white/10 px-4 py-2 text-sm">Cancelar</button><button disabled={commentActionId === comment.id || editContent.trim().length < 2} className="rounded-full bg-[#ff8a3d] px-4 py-2 text-sm font-bold text-[#21140e] disabled:opacity-50">Salvar</button></div></form> : <p className="mt-4 whitespace-pre-wrap leading-7 text-[#d2c5bb]">{comment.content}</p>}
                      {currentUserId && comment.author_id !== currentUserId && <ReportButton key={comment.id + currentUserId} targetType="comment" targetId={comment.id} />}
                    </article>
                  )) : <div className="rounded-xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">Nenhum comentário ainda. Seja o primeiro a responder.</div>}
                </div>
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
