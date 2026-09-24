"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TemporarySessionNotice() {
  const router = useRouter();
  const [expires, setExpires] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let version = 0;
    async function check() {
      const request = ++version;
      const { data: { user } } = await supabase.auth.getUser();
      if (!live || request !== version) return;
      if (!user) { setExpires(null); return; }
      const { data } = await supabase.from("profiles").select("temporary_expires_at").eq("id", user.id).maybeSingle();
      if (!live || request !== version) return;
      setExpires(data?.temporary_expires_at || null);
      if (data?.temporary_expires_at) {
        const active = await supabase.rpc("account_is_active");
        if (live && request === version && !active.error && !active.data) router.replace("/conta-temporaria");
      }
    }
    const refresh = () => { void check().catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { live = false; version++; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  if (!expires) return null;
  return <div className="mt-5 rounded-lg border border-[#ff8a3d]/30 p-3 text-xs text-[#ffd19a]">
    <p>Conta temporária · até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(expires))}</p>
    <Link href="/conta-temporaria" className="mt-2 inline-block underline">Ver minha conta</Link>
  </div>;
}
