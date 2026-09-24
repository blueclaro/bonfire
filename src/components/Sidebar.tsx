"use client";

import Link from "next/link";
import BonfireLogo from "@/components/BonfireLogo";
import { useState } from "react";
import ModerationLink from "@/components/ModerationLink";
import NotificationBell from "@/components/NotificationBell";
import TemporarySessionNotice from "@/components/TemporarySessionNotice";

type Active = "inicio" | "foruns" | "chats" | "avisos" | "perfil" | "denuncias" | "notificacoes" | "mensagens";
const items: { label: string; href: string; key: Active }[] = [
  { label: "Feed", href: "/", key: "inicio" },
  { label: "Mensagens", href: "/mensagens", key: "mensagens" },
  { label: "Fóruns", href: "/foruns", key: "foruns" },
  { label: "Chats", href: "/chats", key: "chats" },
  { label: "Avisos", href: "/avisos", key: "avisos" },
  { label: "Perfil", href: "/perfil", key: "perfil" },
];

export default function Sidebar({ active, showRooms = true }: { active: Active; showRooms?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <aside className="min-w-0 self-start border-b border-white/10 p-4 xl:min-h-screen xl:border-b-0 xl:border-r xl:p-6" onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>
    <div className="flex items-center justify-between gap-3 xl:mb-10">
    <Link className="flex min-w-0 items-center gap-3" href="/">
      <BonfireLogo />
      <div><h1 className="text-2xl font-bold">Bonfire</h1><p className="text-sm text-[#b9aaa0]">comunidade escolar</p></div>
    </Link>
    <button type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(open => !open)} className="min-h-11 shrink-0 rounded-xl border border-white/20 px-4 text-sm font-bold text-[#ffd19a] xl:hidden">{menuOpen ? "Fechar" : "Menu"}</button>
    </div>
    <div id="main-navigation" data-open={menuOpen} className="mobile-navigation">
    <div className="mobile-navigation-content"><div className="pt-4 xl:pt-0">
    <nav aria-label="Navegação principal" onClick={() => setMenuOpen(false)} className="grid gap-1 text-[#b9aaa0] xl:gap-2">
      {items.map(item => <Link key={item.key} href={item.href} aria-current={item.key === active ? "page" : undefined} className={`rounded-lg px-4 py-3 ${item.key === active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>)}
      <ModerationLink active={active === "denuncias"} />
      <NotificationBell active={active === "notificacoes"} />
    </nav>
    <TemporarySessionNotice />
    </div></div>
    </div>
    {showRooms && <div className="mt-8 hidden border-t border-white/10 pt-6 xl:block">
      <p className="mb-3 text-xs uppercase tracking-[.2em] text-[#7d7068]">Salas ativas</p>
      <div className="space-y-3 text-sm text-[#b9aaa0]"><p># 2º informática</p><p># dúvidas enem</p><p># trabalhos</p><p># eventos</p></div>
    </div>}
  </aside>;
}
