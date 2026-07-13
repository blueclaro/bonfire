import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { forumCategories, forumFilters } from "@/data/mockData";

export default function ForunsPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <Sidebar active="foruns" />

        <section className="p-4 md:p-8">
          <header className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
                Fóruns
              </p>

              <h2 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
                Discussões organizadas por assunto.
              </h2>

              <p className="mt-4 max-w-2xl text-[#b9aaa0]">
                Encontre dúvidas, projetos, avisos e conversas da sua turma em
                espaços separados por permissão.
              </p>
            </div>

            <button className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">
              Criar categoria
            </button>
          </header>

          <div className="mb-6 flex flex-wrap gap-2">
            {forumFilters.map((filter, index) => (
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
            ))}
          </div>

          <div className="mb-6">
            <input
              className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none placeholder:text-[#7d7068] focus:border-[#ff8a3d]"
              placeholder="Buscar categoria ou assunto..."
            />
          </div>

          <div className="grid gap-3">
            {forumCategories.map((category) => (
              <Link
                key={category.name}
                href="/foruns/trabalhos-e-ppo"
                className="group rounded-xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-[#ff8a3d]/40 hover:bg-white/[0.065]"
              >
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
                  <div>
                    <h3 className="text-xl font-bold group-hover:text-[#ffd19a]">
                      {category.name}
                    </h3>

                    <p className="mt-2 text-[#b9aaa0]">
                      {category.description}
                    </p>
                  </div>

                  <span className="rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-sm text-[#ffd19a]">
                    {category.visibility}
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-2 text-sm text-[#7d7068] sm:flex-row sm:gap-5">
                  <span>{category.topics} tópicos</span>
                  <span>Última atividade: {category.last}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}