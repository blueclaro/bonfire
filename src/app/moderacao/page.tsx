"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AccountModerationPanel from "@/components/AccountModerationPanel";
import ReportsPanel from "@/components/ReportsPanel";
import { supabase } from "@/lib/supabase";

export default function ModerationPage() {
  const [tab, setTab] = useState<"accounts" | "reports">("accounts");
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    if (new URLSearchParams(window.location.search).get("aba") === "denuncias") setTab("reports");
    void supabase.rpc("can_review_accounts").then(({ data, error }) => {
      if (live) { setAllowed(!error && data === true); setLoading(false); }
    });
    return () => { live = false; };
  }, []);
  return <main className="min-h-screen bg-[#100f0e] text-[#f6efe7] app-shell xl:grid xl:grid-cols-[260px_1fr]">
    <Sidebar active="denuncias" showRooms={false} />
    <section className="mx-auto w-full max-w-5xl p-5 md:p-10">
      <h1 className="text-3xl font-black">Moderação</h1>
      <p className="mt-3 text-[#b9aaa0]">Área privada da coordenação e dos moderadores para analisar novos cadastros e denúncias.</p>
      {loading ? <p className="mt-6" role="status">Verificando acesso…</p> : !allowed ? <p role="alert" className="mt-6 text-red-200">Área restrita à coordenação e aos moderadores. Verifique seu acesso e se a migração foi aplicada.</p> : <>
        <div role="tablist" aria-label="Filas de moderação" className="mt-6 flex flex-wrap gap-3 border-b border-white/10 pb-4">
          <button id="accounts-tab" role="tab" aria-selected={tab === "accounts"} aria-controls="moderation-panel" onClick={() => setTab("accounts")} className={`rounded-full px-5 py-3 font-bold ${tab === "accounts" ? "bg-[#ff8a3d] text-[#21140e]" : "border border-white/20"}`}>Verificação de contas</button>
          <button id="reports-tab" role="tab" aria-selected={tab === "reports"} aria-controls="moderation-panel" onClick={() => setTab("reports")} className={`rounded-full px-5 py-3 font-bold ${tab === "reports" ? "bg-[#ff8a3d] text-[#21140e]" : "border border-white/20"}`}>Posts denunciados</button>
        </div>
        <div id="moderation-panel" role="tabpanel" aria-labelledby={tab === "accounts" ? "accounts-tab" : "reports-tab"}>
          {tab === "accounts" ? <AccountModerationPanel /> : <ReportsPanel />}
        </div>
      </>}
    </section>
  </main>;
}
