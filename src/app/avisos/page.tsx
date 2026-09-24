"use client";

import Sidebar from "@/components/Sidebar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const audiences = {
  everyone: "Todos", students: "Alunos", teachers: "Professores",
  class: "Turma", staff: "Equipe", moderation: "Moderação",
};
type Audience = keyof typeof audiences;
type Notice = {
  id: string; author_id: string; title: string; content: string; created_at: string;
  visibility: Audience; class_name: string | null;
  author: { display_name: string | null; username: string | null } | null;
};

export default function AvisosPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestRef = useRef(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Audience>("everyone");
  const [className, setClassName] = useState("");
  const canPublish = ["teacher", "coordination", "moderator"].includes(role);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      if (!isSupabaseConfigured) throw new Error("O serviço de avisos ainda não está configurado.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }
      const [profile, result] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
        supabase.from("announcements")
          .select("id, author_id, title, content, created_at, visibility, class_name, author:profiles!announcements_author_id_fkey(display_name, username)")
          .order("created_at", { ascending: false }).order("id", { ascending: false }),
      ]);
      if (profile.error) throw new Error("Não foi possível verificar seu perfil.");
      if (result.error) throw new Error("Não foi possível carregar os avisos. Tente novamente.");
      if (request !== requestRef.current) return;
      setRole(profile.data.role);
      setUserId(auth.user.id);
      setNotices(result.data as unknown as Notice[]);
    } catch (error) {
      if (request === requestRef.current) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os avisos.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
    return () => { requestRef.current++; };
  }, [load]);

  useEffect(() => {
    if (!loading && window.location.hash.startsWith("#aviso-")) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
    }
  }, [loading, notices]);

  function resetForm() {
    setEditingId(null);
    setTitle(""); setContent(""); setClassName(""); setVisibility("everyone");
    setFormError("");
  }

  function edit(notice: Notice) {
    if (savingRef.current || !canPublish || notice.author_id !== userId) return;
    setEditingId(notice.id);
    setTitle(notice.title); setContent(notice.content);
    setClassName(notice.class_name ?? ""); setVisibility(notice.visibility);
    setFormError(""); setActionError(""); setSuccess("");
    setShowForm(true);
  }

  useEffect(() => {
    if (showForm) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector("input")?.focus({ preventScroll: true });
    }
  }, [showForm, editingId]);

  async function remove(notice: Notice) {
    if (savingRef.current || !canPublish || notice.author_id !== userId) return;
    if (!window.confirm('Excluir o aviso "' + notice.title + '"? Esta ação não pode ser desfeita.')) return;
    savingRef.current = true; setSaving(true);
    setActionError(""); setSuccess("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }
      const result = await supabase.from("announcements").delete()
        .eq("id", notice.id).eq("author_id", auth.user.id).select("id").single();
      if (result.error || !result.data) throw new Error("Não foi possível excluir. O aviso pode ter sido removido ou sua permissão pode ter mudado.");
      if (editingId === notice.id) { resetForm(); setShowForm(false); }
      setNotices(current => current.filter(item => item.id !== notice.id));
      setSuccess("Aviso excluído com sucesso.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir o aviso.");
    } finally {
      savingRef.current = false; setSaving(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !canPublish) return;
    setFormError("");
    setSuccess("");
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (cleanTitle.length < 5 || cleanTitle.length > 120 || cleanContent.length < 10 || cleanContent.length > 5000) {
      setFormError("Use de 5 a 120 caracteres no título e de 10 a 5.000 no conteúdo.");
      return;
    }
    if (visibility === "class" && (!className.trim() || className.trim().length > 80)) {
      setFormError("Informe a turma, com até 80 caracteres.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) { router.replace("/login"); return; }
      const values = {
        title: cleanTitle, content: cleanContent, visibility,
        class_name: visibility === "class" ? className.trim() : null,
      };
      const result = editingId
        ? await supabase.from("announcements").update(values).eq("id", editingId)
          .eq("author_id", data.user.id).select("id").single()
        : await supabase.from("announcements").insert({ ...values, author_id: data.user.id }).select("id").single();
      if (result.error || !result.data) throw new Error("Não foi possível salvar. Verifique sua conexão e permissão; o aviso pode ter sido removido.");
      setSuccess(editingId ? "Aviso atualizado com sucesso." : "Aviso publicado com sucesso.");
      resetForm();
      setShowForm(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível publicar o aviso.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const fieldClass = "mt-2 w-full rounded-lg border border-white/10 bg-[#181513] px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]";
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="app-shell grid min-h-screen xl:grid-cols-[260px_1fr]">
        <Sidebar active="avisos" />
        <section className="min-w-0 p-4 md:p-8">
          <header className="mb-8">
            <p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">Avisos</p>
            <h1 className="text-3xl font-black sm:text-4xl md:text-5xl">Comunicados oficiais do colégio.</h1>
            <p className="mt-4 text-[#b9aaa0]">Prazos, reuniões, provas e eventos importantes em um só lugar.</p>
            {canPublish && <button disabled={saving} onClick={() => { resetForm(); setShowForm(!showForm); }} className="mt-5 rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">{showForm ? "Cancelar" : "Publicar aviso"}</button>}
          </header>
          {success && <p role="status" className="mb-5 text-green-200">{success}</p>}
          {actionError && <p role="alert" className="mb-5 text-red-200">{actionError}</p>}
          {showForm && canPublish && <form ref={formRef} onSubmit={publish} className="mb-8 rounded-2xl border border-white/10 bg-white/[.045] p-5">
            <h2 className="mb-5 text-2xl font-bold">{editingId ? "Editar aviso" : "Novo aviso"}</h2>
            <fieldset disabled={saving} className="grid gap-5 disabled:opacity-60">
              <label>Título<input required minLength={5} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} /></label>
              <label>Conteúdo<textarea required minLength={10} maxLength={5000} rows={6} value={content} onChange={e => setContent(e.target.value)} className={fieldClass} /></label>
              <label>Público<select value={visibility} onChange={e => setVisibility(e.target.value as Audience)} className={fieldClass}>
                {Object.entries(audiences).filter(([key]) => key !== "moderation" || role !== "teacher").map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              {visibility === "class" && <label>Turma<input required maxLength={80} value={className} onChange={e => setClassName(e.target.value)} className={fieldClass} /><span className="mt-1 block text-sm text-[#b9aaa0]">Use o nome exato cadastrado nos perfis dos alunos.</span></label>}
              {formError && <p role="alert" className="text-red-200">{formError}</p>}
              <button className="w-fit rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Confirmar publicação"}</button>
            </fieldset>
          </form>}
          {loadError && <div role="alert" className="mb-5 rounded-xl border border-red-400/30 p-4 text-red-200">{loadError}<button onClick={() => void load()} className="ml-3 underline">Tentar novamente</button></div>}
          {loading ? <p role="status">Carregando avisos...</p> : !loadError && <div className="grid gap-4">
            {notices.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">Nenhum aviso disponível para você no momento.</p> : notices.map(notice => <article id={"aviso-" + notice.id} key={notice.id} className="scroll-mt-6 rounded-xl border border-white/10 bg-white/[.045] p-6">
              <span className="rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-sm text-[#ffd19a]">{notice.visibility === "class" ? notice.class_name : audiences[notice.visibility]}</span>
              <h2 className="mt-4 break-words text-2xl font-bold">{notice.title}</h2>
              <p className="mt-2 text-sm text-[#b9aaa0]">{notice.author?.display_name || notice.author?.username || "Equipe escolar"} · <time dateTime={notice.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notice.created_at))}</time></p>
              <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-[#b9aaa0]">{notice.content}</p>
              {canPublish && notice.author_id === userId && <div className="mt-5 flex gap-4">
                <button type="button" disabled={saving} onClick={() => edit(notice)} aria-label={"Editar aviso: " + notice.title} className="text-sm text-[#ffd19a] hover:underline disabled:opacity-50">Editar</button>
                <button type="button" disabled={saving} onClick={() => void remove(notice)} aria-label={"Excluir aviso: " + notice.title} className="text-sm text-red-200 hover:underline disabled:opacity-50">Excluir</button>
              </div>}
            </article>)}
          </div>}
        </section>
      </section>
    </main>
  );
}
