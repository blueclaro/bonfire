import Link from "next/link";

type SidebarProps = {
  active: "inicio" | "foruns" | "chats" | "avisos" | "perfil";
  showRooms?: boolean;
};

const navItems = [
  {
    label: "Início",
    href: "/",
    key: "inicio",
  },
  {
    label: "Fóruns",
    href: "/foruns",
    key: "foruns",
  },
  {
    label: "Chats",
    href: "/chats",
    key: "chats",
  },
  {
    label: "Avisos",
    href: "/avisos",
    key: "avisos",
  },
  {
    label: "Perfil",
    href: "/perfil",
    key: "perfil",
  },
] as const;

const activeRooms = [
  "# 2º informática",
  "# dúvidas enem",
  "# trabalhos",
  "# eventos",
];

export default function Sidebar({ active, showRooms = true }: SidebarProps) {
  return (
    <aside className="border-b border-white/10 p-5 md:p-6 xl:border-b-0 xl:border-r">
      <Link className="mb-8 flex items-center gap-3 md:mb-10" href="/">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8a3d] text-xl">
          🔥
        </div>

        <div>
          <h1 className="text-2xl font-bold">Bonfire</h1>
          <p className="text-sm text-[#b9aaa0]">comunidade escolar</p>
        </div>
      </Link>

      <nav className="grid grid-cols-2 gap-2 text-[#b9aaa0] sm:grid-cols-5 xl:grid-cols-1">
        {navItems.map((item) => {
          const isActive = item.key === active;

          return (
            <Link
              key={item.key}
              className={`block rounded-lg px-4 py-3 text-center transition xl:text-left ${
                isActive
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/5 hover:text-white"
              }`}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {showRooms && (
        <div className="mt-8 hidden border-t border-white/10 pt-6 xl:block">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#7d7068]">
            Salas ativas
          </p>

          <div className="space-y-3 text-sm text-[#b9aaa0]">
            {activeRooms.map((room) => (
              <p key={room}>{room}</p>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}