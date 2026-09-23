"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EditablePost = { id: string; author_id: string; category_id: string; title: string; content: string };

export default function TopicActions({ post, onSaved }: {
  post: EditablePost;
  onSaved: (changes: { title: string; content: string; updated_at: string }) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function owner() {
    const result = await supabase.auth.getUser();
    if (result.error || !result.data.user) {
      router.push("/login");
      throw new Error("Entre novamente para continuar.");
    }
    if (result.data.user.id !== post.author_id) throw new Error("Apenas o autor pode alterar este tópico.");
    return result.data.user.id;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setError(""); setSuccess("");
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (cleanTitle.length < 5 || cleanTitle.length > 120 || cleanContent.length < 10 || cleanContent.length > 5000) {
      setError("Use de 5 a 120 caracteres no título e de 10 a 5.000 no conteúdo.");
      return;
    }
    lock.current = true; setBusy(true);
    try {
      const userId = await owner();
      const result = await supabase.from("posts")
        .update({ title: cleanTitle, content: cleanContent })
        .eq("id", post.id).eq("author_id", userId)
        .select("title, content, updated_at").single();
      if (result.error || !result.data) throw new Error("Não foi possível salvar. O tópico pode ter sido removido ou seu acesso pode ter mudado.");
      onSaved(result.data);
      setEditing(false); setSuccess("Tópico atualizado com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o tópico.");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function remove() {
    if (lock.current) return;
    if (!window.confirm('Excluir o tópico "' + post.title + '"? Todos os comentários também serão excluídos. Esta ação não pode ser desfeita.')) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const userId = await owner();
      const result = await supabase.from("posts").delete()
        .eq("id", post.id).eq("author_id", userId).select("id").single();
      if (result.error || !result.data) throw new Error("Não foi possível excluir. O tópico pode ter sido removido ou seu acesso pode ter mudado.");
      router.replace("/foruns/" + post.category_id);
      router.refresh();
      // Mantém os controles desativados até sair do tópico excluído.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o tópico.");
      lock.current = false; setBusy(false);
    }
  }

  return <section aria-label="Gerenciar meu tópico" className="mt-6 border-t border-white/10 pt-5">
    {editing ? <form onSubmit={save}>
      <h2 className="mb-4 text-xl font-bold">Editar tópico</h2>
      <fieldset disabled={busy} className="grid gap-4 disabled:opacity-60">
        <label>Título<input autoFocus required minLength={5} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]" /></label>
        <label>Conteúdo<textarea required minLength={10} maxLength={5000} rows={7} value={content} onChange={e => setContent(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]" /></label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e]">{busy ? "Salvando..." : "Salvar alterações"}</button>
          <button type="button" onClick={() => { setEditing(false); setError(""); }} className="rounded-full border border-white/10 px-4 py-2">Cancelar</button>
        </div>
      </fieldset>
    </form> : <div className="flex gap-4">
      <button type="button" disabled={busy} onClick={() => {
        setTitle(post.title); setContent(post.content);
        setError(""); setSuccess(""); setEditing(true);
      }} className="text-sm text-[#ffd19a] hover:underline disabled:opacity-50">Editar tópico</button>
      <button type="button" disabled={busy} onClick={() => void remove()} className="text-sm text-red-200 hover:underline disabled:opacity-50">{busy ? "Excluindo..." : "Excluir tópico"}</button>
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    {success && <p role="status" className="mt-4 text-sm text-green-200">{success}</p>}
  </section>;
}
