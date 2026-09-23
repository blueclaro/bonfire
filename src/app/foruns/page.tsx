"use client";

import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  class_name: string | null;
  created_at: string;
  topicCount: number;
};

const visibilityLabels: Record<string, string> = {
  everyone: "Todos",
  students: "Alunos",
  teachers: "Professores",
  class: "Turma",
  staff: "Equipe",
  moderation: "Moderação",
};

export default function ForunsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);

    const [{ data: categoryData, error: categoryError }, { data: postData }] =
      await Promise.all([
        supabase
          .from("forum_categories")
          .select("id, name, description, visibility, class_name, created_at")
          .order("name"),
        supabase.from("posts").select("id, category_id"),
      ]);

    if (categoryError) {
      setMessage(`Não foi possível carregar as categorias: ${categoryError.message}`);
      setLoading(false);
      return;
    }

    const counts = new Map<string, number>();
    for (const post of postData ?? []) {
      counts.set(post.category_id, (counts.get(post.category_id) ?? 0) + 1);
    }

    const loadedCategories = (categoryData ?? []).map((category) => ({
      ...category,
      topicCount: counts.get(category.id) ?? 0,
    }));

    setCategories(loadedCategories);
    setCategoryId((current) => current || loadedCategories[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!categoryId) {
      setMessage("Escolha uma categoria.");
      return;
    }

    if (cleanTitle.length < 5 || cleanTitle.length > 120) {
      setMessage("O título deve ter entre 5 e 120 caracteres.");
      return;
    }

    if (cleanContent.length < 10 || cleanContent.length > 5000) {
      setMessage("O conteúdo deve ter entre 10 e 5000 caracteres.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.push("/login");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("posts")
      .insert({
        category_id: categoryId,
        author_id: userData.user.id,
        title: cleanTitle,
        content: cleanContent,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setMessage(`Não foi possível publicar: ${error.message}`);
      return;
    }

    setTitle("");
    setContent("");
    setShowForm(false);
    await loadCategories();
    router.push(`/foruns/topico/${data.id}`);
  }

  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen xl:grid-cols-[260px_1fr]">
        <Sidebar active="foruns" />

        <section className="p-4 md:p-8">
          <header className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">Fóruns</p>
              <h1 className="text-4xl font-black md:text-5xl">Discussões organizadas por assunto.</h1>
              <p className="mt-4 max-w-2xl text-[#b9aaa0]">Compartilhe dúvidas, projetos e ideias com a comunidade escolar.</p>
            </div>

            <button
              onClick={() => { setMessage(""); setShowForm((current) => !current); }}
              className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]"
            >
              {showForm ? "Fechar" : "Criar tópico"}
            </button>
          </header>

          {showForm && (
            <form onSubmit={handleCreateTopic} className="mb-8 rounded-2xl border border-[#ff8a3d]/30 bg-white/[.045] p-5 md:p-7">
              <h2 className="mb-5 text-2xl font-black">Novo tópico</h2>
              <div className="grid gap-5">
                <label className="text-sm text-[#b9aaa0]">
                  Categoria
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#181513] px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]">
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>

                <label className="text-sm text-[#b9aaa0]">
                  Título
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Qual assunto você quer discutir?" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]" />
                  <span className="mt-1 block text-right text-xs text-[#7d7068]">{title.length}/120</span>
                </label>

                <label className="text-sm text-[#b9aaa0]">
                  Conteúdo
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} rows={7} placeholder="Explique sua dúvida ou compartilhe sua ideia..." className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]" />
                  <span className="mt-1 block text-right text-xs text-[#7d7068]">{content.length}/5000</span>
                </label>
              </div>

              {message && <p className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">{message}</p>}

              <button disabled={saving || categories.length === 0} className="mt-6 rounded-full bg-[#ff8a3d] px-6 py-3 font-bold text-[#21140e] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Publicando..." : "Publicar tópico"}
              </button>
            </form>
          )}

          {!showForm && message && <p className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</p>}

          {loading ? (
            <p className="text-[#b9aaa0]">Carregando categorias...</p>
          ) : categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-[#b9aaa0]">Nenhuma categoria foi criada no banco.</div>
          ) : (
            <div className="grid gap-3">
              {categories.map((category) => (
                <Link key={category.id} href={`/foruns/${category.id}`} className="group rounded-xl border border-white/10 bg-white/[.045] p-5 hover:border-[#ff8a3d]/40">
                  <div className="flex flex-col justify-between gap-4 md:flex-row">
                    <div>
                      <h2 className="text-xl font-bold group-hover:text-[#ffd19a]">{category.name}</h2>
                      <p className="mt-2 text-[#b9aaa0]">{category.description || "Categoria sem descrição."}</p>
                    </div>
                    <span className="h-fit rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-sm text-[#ffd19a]">
                      {category.class_name || visibilityLabels[category.visibility] || category.visibility}
                    </span>
                  </div>
                  <p className="mt-5 text-sm text-[#7d7068]">{category.topicCount} {category.topicCount === 1 ? "tópico" : "tópicos"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
