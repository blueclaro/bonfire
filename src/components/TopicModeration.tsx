"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flags = { is_pinned: boolean; is_locked: boolean };

export default function TopicModeration({ postId, flags, onChanged }: {
  postId: string; flags: Flags; onChanged: (flags: Flags) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function change(action: "pin" | "lock", enabled: boolean) {
    if (pending.current) return;
    if (action === "lock" && enabled && !window.confirm("Fechar este tópico para novas respostas? Os comentários existentes serão preservados. Você poderá reabri-lo depois.")) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await supabase.rpc("moderate_post", {
        target_post_id: postId, moderation_action: action, enabled,
      }).single();
      if (!active.current) return;
      if (result.error || !result.data) throw new Error("Não foi possível alterar o tópico. Verifique sua conexão e sua permissão de moderação.");
      const updated = result.data as Flags;
      onChanged(updated);
      setMessage(action === "pin"
        ? enabled ? "Tópico fixado no início da categoria." : "Tópico desafixado."
        : enabled ? "Novas respostas foram bloqueadas." : "Tópico reaberto para respostas.");
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Não foi possível moderar o tópico.");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <section aria-label="Moderação do tópico" className="mt-6 border-t border-white/10 pt-5">
    <h2 className="mb-3 text-sm font-bold text-[#b9aaa0]">Moderação</h2>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void change("pin", !flags.is_pinned)} className="rounded-full border border-[#ff8a3d]/30 px-4 py-2 text-sm text-[#ffd19a] disabled:opacity-50">{flags.is_pinned ? "Desafixar tópico" : "Fixar tópico"}</button>
      <button type="button" disabled={busy} onClick={() => void change("lock", !flags.is_locked)} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50">{flags.is_locked ? "Reabrir respostas" : "Bloquear respostas"}</button>
    </div>
    {busy && <p role="status" className="mt-3 text-sm text-[#b9aaa0]">Salvando moderação...</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-200">{message}</p>}
  </section>;
}
