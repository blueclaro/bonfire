"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET, avatarStoragePath } from "@/lib/profilePhoto";

export default function ProfileAvatar({ value, name = "Usuário", className = "h-11 w-11", decorative = false }: {
  value?: string | null; name?: string; className?: string; decorative?: boolean;
}) {
  const path = avatarStoragePath(value);
  const external = !path && value && /^(https?:\/\/|blob:)/i.test(value) ? value : "";
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (!path) return;
    let live = true;
    async function refresh() {
      try {
        const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path!, 300);
        if (live) { setSigned(!error && data ? { path: path!, url: data.signedUrl } : null); setFailed(""); }
      } catch { if (live) setSigned(null); }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 240000);
    return () => { live = false; clearInterval(timer); };
  }, [path]);
  const url = path ? signed?.path === path ? signed.url : "" : external;
  if (url && failed !== url) return <img src={url} alt={decorative ? "" : `Foto de ${name}`} referrerPolicy="no-referrer" onError={() => setFailed(url)} className={`${className} shrink-0 rounded-full object-cover`} />;
  return <span aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Perfil de ${name}`} className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[#ff8a3d]/20 font-bold text-[#ffd19a]`}>{Array.from(name.trim() || "B")[0].toLocaleUpperCase("pt-BR")}</span>;
}
