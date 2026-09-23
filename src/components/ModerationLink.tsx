"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ModerationLink({ active }: { active: boolean }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    let version = 0;
    async function check() {
      const current = ++version;
      setAllowed(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (live && current === version) setAllowed(["moderator", "coordination"].includes(data?.role || ""));
    }
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void check(); });
    return () => { live = false; version++; subscription.unsubscribe(); };
  }, []);
  if (!allowed) return null;
  return <Link href="/denuncias" className={`rounded-lg px-4 py-3 text-center xl:text-left ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>Denúncias</Link>;
}
