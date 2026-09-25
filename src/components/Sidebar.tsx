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
  { label: "Chats", href: "/chats", key: "chats" },
  { label: "Avisos", href: "/avisos", key: "avisos" },
  { label: "Perfil", href: "/perfil", key: "perfil" },
];

export default function Sidebar({ active, showRooms: _showRooms = false, mobileDocked = false }: { active: Active; showRooms?: boolean; mobileDocked?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <aside className={`min-w-0 self-start border-white/10 bg-[#11100f] p-4 xl:min-h-screen xl:border-b-0 xl:border-r xl:p-6 ${mobileDocked ? "fixed inset-x-0 bottom-0 z-50 order-2 border-t shadow-[0_-12px_35px_rgba(0,0,0,.45)] xl:static xl:order-1 xl:border-t-0" : "border-b"}`} onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>
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
  </aside>;
}
