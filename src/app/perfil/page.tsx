"use client";

import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import SchoolLabelEditor from "@/components/SchoolLabelEditor";
import Link from "next/link";
import { clearLocalAuthSession, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  role: "student" | "teacher" | "coordination" | "moderator";
  class_name: string | null;
  avatar_url: string | null;
  bio: string;
  school_label?: string;
  temporary_expires_at?: string | null;
};

type RecentPost = { id: string; title: string; content: string; created_at: string };

const roleLabels: Record<Profile["role"], string> = {
  student: "Aluno",
  teacher: "Professor",
  coordination: "Coordenação",
  moderator: "Moderador",
};

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [classNameInput, setClassNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        await clearLocalAuthSession();
        router.replace("/login");
        return;
      }

      const user = userData.user;
      const [profileResult, postsResult, postCountResult, commentCountResult] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("posts").select("id, title, content, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        ]);

      if (profileResult.error?.code === "PGRST116" || (!profileResult.error && !profileResult.data)) {
        await clearLocalAuthSession();
        router.replace(user.is_anonymous ? "/conta-temporaria" : "/login");
        return;
      }

      if (profileResult.error) {
        setErrorMessage("Não foi possível carregar seu perfil. Confirme se o schema.sql foi executado no Supabase.");
        setLoading(false);
        return;
      }

      const loadedProfile = profileResult.data as Profile;
      setProfile(loadedProfile);
      setDisplayNameInput(loadedProfile.display_name ?? "");
      setUsernameInput(loadedProfile.username ?? "");
      setClassNameInput(loadedProfile.class_name ?? "");
      setBioInput(loadedProfile.bio ?? "");
      setPosts((postsResult.data ?? []) as RecentPost[]);
      setPostCount(postCountResult.count ?? 0);
      setCommentCount(commentCountResult.count ?? 0);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function handleLogout() {
    if (profile?.temporary_expires_at && !window.confirm("Sair da conta temporária? Não será possível recuperá-la pelo nome ou tag.")) return;
    await clearLocalAuthSession();
    router.replace("/login");
    router.refresh();
  }

  async function handleSaveProfile() {
    if (!profile) return;

    const cleanName = displayNameInput.trim();
    const cleanUsername = usernameInput.trim().replace(/^@/, "").toLowerCase();

    if (!cleanName) {
      setSaveMessage("Informe seu nome de exibição.");
      return;
    }

    if (!/^[a-z0-9_!*/.+-]{3,24}$/i.test(cleanUsername)) {
      setSaveMessage("O @ deve ter de 3 a 24 caracteres, sem espaços. Use letras, números ou _ ! * / . + -.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const changes = {
      display_name: cleanName,
      username: cleanUsername,
      bio: bioInput.trim(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      setSaveMessage(
        error.code === "23505"
          ? "Esse nome de usuário já está sendo utilizado."
          : `Não foi possível salvar: ${error.message}`,
      );
      return;
    }

    setProfile(data as Profile);
    setEditing(false);
    setSaveMessage("Perfil atualizado com sucesso.");
  }

  function cancelEditing() {
    if (!profile) return;
    setDisplayNameInput(profile.display_name ?? "");
    setUsernameInput(profile.username ?? "");
    setClassNameInput(profile.class_name ?? "");
    setBioInput(profile.bio ?? "");
    setSaveMessage("");
    setEditing(false);
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#11100f] text-[#f6efe7]"><p className="text-[#b9aaa0]">Carregando seu perfil...</p></main>;
  }

  if (!profile) {
    return <main className="flex min-h-screen items-center justify-center bg-[#11100f] px-6 text-[#f6efe7]"><div className="max-w-lg rounded-xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">{errorMessage || "Perfil não encontrado."}</div></main>;
  }

  const displayName = profile.display_name || profile.username || "Usuário";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="app-shell grid min-h-screen xl:grid-cols-[260px_1fr]">
        <Sidebar active="perfil" />
        <section className="p-4 md:p-8">
          <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-br from-[#21140e] to-[#15110f] p-5 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row">
              <div className="flex flex-col gap-5 sm:flex-row">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={`Foto de ${displayName}`} className="h-24 w-24 rounded-full object-cover" />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#ff8a3d] text-4xl font-black text-[#21140e]">{initial}</div>
                )}
                <div>
                  <p className="text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">{profile.temporary_expires_at ? "Conta temporária da apresentação" : "Perfil de " + roleLabels[profile.role]}</p>
                  <h1 className="mt-2 text-3xl font-black sm:text-4xl md:text-5xl">{displayName}</h1>
                  <SchoolLabelEditor initial={profile.school_label || ""}/>
                  {!profile.temporary_expires_at && <p className="mt-2 text-[#b9aaa0]">@{profile.username || "sem-usuario"}</p>}
                  <p className="mt-5 max-w-2xl leading-7 text-[#b9aaa0]">{profile.bio || "Este usuário ainda não adicionou uma biografia."}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {!profile.temporary_expires_at && <button onClick={() => { setSaveMessage(""); setEditing(true); }} className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">Editar perfil</button>}
                <button onClick={handleLogout} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-bold text-[#ffd19a]">Sair</button>
              </div>
            </div>
          </div>

          {editing && (
            <section className="mb-8 rounded-2xl border border-[#ff8a3d]/30 bg-white/[.045] p-5 md:p-8">
              <div className="mb-6">
                <p className="text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">Configurações</p>
                <h2 className="mt-2 text-3xl font-black">Editar perfil</h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm text-[#b9aaa0]">
                  Nome de exibição
                  <input value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} maxLength={80} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]" />
                </label>

                <label className="text-sm text-[#b9aaa0]">
                  Nome de usuário
                  <div className="mt-2 flex rounded-lg border border-white/10 bg-black/20 focus-within:border-[#ff8a3d]">
                    <span className="px-4 py-3 text-[#7d7068]">@</span>
                    <input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} maxLength={24} className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-[#f6efe7] outline-none" />
                  </div>
                </label>

                <label className="text-sm text-[#b9aaa0] md:col-span-2">
                  Turma de acesso (administração)
                  <input value={classNameInput} disabled className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#7d7068] opacity-70" />
                  <span className="mt-1 block text-xs text-[#7d7068]">A turma é definida pela administração da escola.</span>
                </label>

                <label className="text-sm text-[#b9aaa0] md:col-span-2">
                  Biografia
                  <textarea value={bioInput} onChange={(event) => setBioInput(event.target.value)} maxLength={300} rows={4} placeholder="Conte um pouco sobre você..." className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[#f6efe7] outline-none focus:border-[#ff8a3d]" />
                  <span className="mt-1 block text-right text-xs text-[#7d7068]">{bioInput.length}/300</span>
                </label>
              </div>

              {saveMessage && <p className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">{saveMessage}</p>}

              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={handleSaveProfile} disabled={saving} className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:opacity-60">{saving ? "Salvando..." : "Salvar alterações"}</button>
                <button onClick={cancelEditing} disabled={saving} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-bold">Cancelar</button>
              </div>
            </section>
          )}

          {!editing && saveMessage && <p className="mb-6 rounded-lg border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm text-green-200">{saveMessage}</p>}

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-4 text-2xl font-bold">Faíscas recentes</h2>
              <div className="grid gap-3">
                {posts.length > 0 ? posts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-white/10 bg-white/[.045] p-5">
                    <h3 className="text-xl font-bold"><Link href={`/foruns/topico/${post.id}`}>{post.title || post.content.slice(0,120) || "Faísca com imagem"}</Link></h3>
                    <p className="mt-2 text-sm text-[#7d7068]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.created_at))}</p>
                  </article>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">Você ainda não criou nenhuma faísca.</div>
                )}
              </div>
            </section>
            <aside>
              <div className="rounded-xl border border-white/10 bg-white/[.045] p-5">
                <h2 className="text-xl font-bold">Participação</h2>
                <StatCard label="Faíscas criadas" value={String(postCount)} />
                <StatCard label="Comentários" value={String(commentCount)} />
              </div>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}
