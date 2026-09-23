"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = {
  display_name: string | null;
  username: string | null;
  class_name: string | null;
  avatar_url: string | null;
};
type Status = "loading" | "ready" | "signed-out" | "missing" | "error";

export default function HomeProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const version = ++request.current;
      const current = () => active && version === request.current;
      setProfile(null);
      setStatus("loading");
      setFailedAvatar(null);
      try {
        if (!isSupabaseConfigured) throw new Error("Configuração indisponível");
        const auth = await supabase.auth.getUser();
        if (!current()) return;
        if (!auth.data.user) {
          setStatus(auth.error && auth.error.name !== "AuthSessionMissingError" ? "error" : "signed-out");
          return;
        }
        if (auth.error) throw auth.error;
        const result = await supabase.from("profiles")
          .select("display_name, username, class_name, avatar_url")
          .eq("id", auth.data.user.id).maybeSingle();
        if (!current()) return;
        if (result.error) throw result.error;
        setProfile(result.data);
        setStatus(result.data ? "ready" : "missing");
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
      setProfile(null);
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

  if (status === "loading") return <p role="status" className="text-sm text-[#b9aaa0]">Carregando perfil...</p>;
  if (status === "signed-out") return <Link href="/login" className="shrink-0 rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">Entrar</Link>;
  if (status === "error") return <div role="status" className="text-sm text-[#b9aaa0]"><p>Não foi possível carregar seu perfil.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-1 text-[#ffd19a] underline">Tentar novamente</button></div>;
  if (status === "missing" || !profile) return <Link href="/perfil" className="text-sm text-[#ffd19a] underline">Perfil indisponível — verificar</Link>;

  const name = profile.display_name?.trim() || profile.username?.trim() || "Usuário";
  const initial = Array.from(name)[0].toLocaleUpperCase("pt-BR");
  const avatar = profile.avatar_url?.trim();
  const showAvatar = avatar && /^https?:\/\//i.test(avatar) && failedAvatar !== avatar;
  return <Link href="/perfil" aria-label={"Abrir perfil de " + name} className="flex min-w-0 max-w-full items-center gap-3 rounded-lg text-[#b9aaa0] hover:text-[#ffd19a] md:max-w-xs md:shrink-0">
    <div className="min-w-0"><span className="block truncate font-semibold" title={name}>{name}</span>
      {profile.class_name?.trim() && <span className="block truncate text-sm" title={profile.class_name}>{profile.class_name}</span>}
    </div>
    {showAvatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatar)} className="h-10 w-10 shrink-0 rounded-full object-cover" /> :
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff8a3d] font-bold text-[#21140e]">{initial}</span>}
  </Link>;
}
