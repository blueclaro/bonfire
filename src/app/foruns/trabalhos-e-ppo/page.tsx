import Link from "next/link";

const topics = [
  {
    title: "Como entregar o relatório final do PPO?",
    author: "Coordenação",
    comments: 12,
    time: "fixado",
    pinned: true,
    locked: false,
  },
  {
    title: "Banco de dados do Bonfire",
    author: "Carlos",
    comments: 8,
    time: "há 20 min",
    pinned: false,
    locked: false,
  },
  {
    title: "Ideias para apresentação",
    author: "Marina",
    comments: 5,
    time: "hoje",
    pinned: false,
    locked: false,
  },
  {
    title: "Divisão das tarefas do grupo",
    author: "Rafa",
    comments: 3,
    time: "ontem",
    pinned: false,
    locked: true,
  },
];

export default function ForumCategoryPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 p-6">
          <Link className="mb-10 flex items-center gap-3" href="/">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8a3d] text-xl">
              🔥
            </div>

            <div>
              <h1 className="text-2xl font-bold">Bonfire</h1>
              <p className="text-sm text-[#b9aaa0]">comunidade escolar</p>
            </div>
          </Link>

          <nav className="space-y-2 text-[#b9aaa0]">
            <Link className="block rounded-lg px-4 py-3 hover:bg-white/5" href="/">
              Início
            </Link>
            <Link className="block rounded-lg bg-white/10 px-4 py-3 text-white" href="/foruns">
              Fóruns
            </Link>
            <Link className="block rounded-lg px-4 py-3 hover:bg-white/5" href="/chats">
              Chats
            </Link>
            <Link className="block rounded-lg px-4 py-3 hover:bg-white/5" href="/avisos">
              Avisos
            </Link>
            <Link className="block rounded-lg px-4 py-3 hover:bg-white/5" href="/perfil">
              Perfil
            </Link>
          </nav>
        </aside>

        <section className="p-8">
          <Link className="text-sm text-[#ffd19a]" href="/foruns">
            ← Voltar para fóruns
          </Link>

          <header className="mt-6 mb-8 flex items-start justify-between gap-6">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
                Fórum
              </p>
              <h2 className="text-5xl font-black tracking-tight">
                Trabalhos e PPO
              </h2>
              <p className="mt-4 max-w-2xl text-[#b9aaa0]">
                Organização de projetos, entregas, equipes, dúvidas técnicas e
                apresentações do trabalho profissionalizante orientado.
              </p>
            </div>

            <Link
              href="/criar-topico"
              className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]"
            >
              Criar tópico
            </Link>
          </header>

          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {["Recentes", "Mais comentados", "Fixados", "Não respondidos"].map(
                (filter, index) => (
                  <button
                    key={filter}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      index === 0
                        ? "bg-[#ff8a3d] text-[#21140e]"
                        : "border border-white/10 bg-white/5 text-[#b9aaa0]"
                    }`}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>

            <input
              className="w-full max-w-sm rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none placeholder:text-[#7d7068] focus:border-[#ff8a3d]"
              placeholder="Buscar tópico..."
            />
          </div>

          <div className="grid gap-3">
            {topics.map((topic) => (
              <Link
                key={topic.title}
                href="/topico/banco-de-dados-do-bonfire"
                className="group rounded-lg border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-[#ff8a3d]/40 hover:bg-white/[0.065]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold group-hover:text-[#ffd19a]">
                      {topic.pinned ? "📌 " : ""}
                      {topic.title}
                    </h3>

                    <p className="mt-2 text-sm text-[#7d7068]">
                      {topic.comments} comentários · {topic.author} · {topic.time}
                    </p>
                  </div>

                  {topic.locked && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-[#b9aaa0]">
                      Bloqueado
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
} 