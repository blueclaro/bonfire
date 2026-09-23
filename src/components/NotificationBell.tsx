"use client";

import Link from "next/link";
import { useNotifications } from "@/lib/useNotifications";

export default function NotificationBell({ active }: { active: boolean }) {
  const { userId, count, error } = useNotifications();
  if (!userId) return null;
  return <Link href="/notificacoes" aria-label={count === null ? "Notificações" : `Notificações: ${count} não lidas`}
    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 xl:justify-start ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    Notificações
    {count !== null && count > 0 && <span className="rounded-full bg-[#ff8a3d] px-2 py-0.5 text-xs font-bold text-[#21140e]">{count > 99 ? "99+" : count}</span>}
    {error && <span title="Não foi possível atualizar o contador" aria-label="Contador indisponível">!</span>}
  </Link>;
}
