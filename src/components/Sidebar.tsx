import Link from "next/link";
import ModerationLink from "@/components/ModerationLink";
import NotificationBell from "@/components/NotificationBell";

type Active = "inicio" | "foruns" | "chats" | "avisos" | "perfil" | "denuncias" | "notificacoes";
const items: { label: string; href: string; key: Active }[] = [
  { label: "Início", href: "/", key: "inicio" },
  { label: "Fóruns", href: "/foruns", key: "foruns" },
  { label: "Chats", href: "/chats", key: "chats" },
  { label: "Avisos", href: "/avisos", key: "avisos" },
  { label: "Perfil", href: "/perfil", key: "perfil" },
];

export default function Sidebar({ active, showRooms = true }: { active: Active; showRooms?: boolean }) {
  return <aside className="border-b border-white/10 p-5 md:p-6 xl:border-b-0 xl:border-r">
    <Link className="mb-8 flex items-center gap-3 md:mb-10" href="/">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8a3d] text-xl">🔥</div>
      <div><h1 className="text-2xl font-bold">Bonfire</h1><p className="text-sm text-[#b9aaa0]">comunidade escolar</p></div>
    </Link>
    <nav className="grid grid-cols-2 gap-2 text-[#b9aaa0] sm:grid-cols-5 xl:grid-cols-1">
      {items.map(item => <Link key={item.key} href={item.href} className={`rounded-lg px-4 py-3 text-center xl:text-left ${item.key === active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>)}
      <ModerationLink active={active === "denuncias"} />
      <NotificationBell active={active === "notificacoes"} />
    </nav>
    {showRooms && <div className="mt-8 hidden border-t border-white/10 pt-6 xl:block">
      <p className="mb-3 text-xs uppercase tracking-[.2em] text-[#7d7068]">Salas ativas</p>
      <div className="space-y-3 text-sm text-[#b9aaa0]"><p># 2º informática</p><p># dúvidas enem</p><p># trabalhos</p><p># eventos</p></div>
    </div>}
  </aside>;
}
