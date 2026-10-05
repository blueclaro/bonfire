"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { clearLocalAuthSession, isSupabaseConfigured, supabase } from "@/lib/supabase";

const publicPaths = new Set(["/login", "/cadastro", "/cadastro/verificacao", "/esqueci-senha", "/redefinir-senha", "/apresentacao"]);
type Approval = { approval_status: string; approval_reason: string | null };

export default function AccountApprovalGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Approval | null>(null);
  const [error, setError] = useState("");
  const version = useRef(0);
  const check = useCallback(async () => {
    const request = ++version.current;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (request !== version.current) return;
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!user) { setProfile(null); setError(""); return; }
      const { data, error: queryError } = await supabase.rpc("my_account_approval");
      if (request !== version.current) return;
      if (queryError) throw queryError;
      if (!data) {
        await clearLocalAuthSession();
        if (request === version.current) { setProfile(null); setError(""); }
        return;
      }
      setProfile(data); setError("");
    } catch {
      if (request === version.current) setError("Não foi possível verificar a aprovação da conta. Tente novamente.");
    } finally { if (request === version.current) setChecking(false); }
  }, []);

  useEffect(() => {
    if (publicPaths.has(pathname) || !isSupabaseConfigured) return;
    setChecking(true);
    void check();
    const refresh = () => { void check(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setChecking(true); setProfile(null); setError("");
      // Consultas aguardam a liberação do processamento da sessão de autenticação.
      setTimeout(refresh, 0);
    });
    return () => { version.current++; clearInterval(timer); window.removeEventListener("focus", refresh); subscription.unsubscribe(); };
  }, [pathname, check]);

  if (publicPaths.has(pathname) || !isSupabaseConfigured) return children;
  if (!checking && !error && (!profile || profile.approval_status === "approved")) return children;
  return <main className="flex min-h-screen items-center justify-center bg-[#11100f] px-6 py-10 text-[#f6efe7]">
    <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[.045] p-7">
      {checking ? <p role="status">Verificando sua conta…</p> : <>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ffd19a]">Etapa 3 de 3 · Verificação pela administração</p>
        <h1 className="mt-3 text-3xl font-black">{error ? "Verificação indisponível" : profile?.approval_status === "rejected" ? "Cadastro não aprovado" : "Aguardando aprovação"}</h1>
        <p role={error ? "alert" : "status"} className="mt-4 text-[#b9aaa0]">{error || (profile?.approval_status === "rejected"
          ? "A administração analisou seu cadastro e não liberou o acesso ao Bonfire."
          : "Seu cadastro está na fila de moderação. Você poderá acessar o Bonfire assim que a administração aprovar sua conta.")}</p>
        {profile?.approval_status === "rejected" && profile.approval_reason && <p className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-black/20 p-4">Motivo: {profile.approval_reason}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => { setChecking(true); void check(); }} className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">Verificar novamente</button>
          <button onClick={() => void clearLocalAuthSession().then(() => window.location.assign("/login")).catch(() => setError("Não foi possível sair. Tente novamente."))} className="rounded-full border border-white/20 px-5 py-3">Sair</button>
        </div>
      </>}
    </section>
  </main>;
}
