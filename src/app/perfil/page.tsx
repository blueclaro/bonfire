import Sidebar from "@/components/Sidebar";
import { profileActivities, profilePosts } from "@/data/mockData";

export default function PerfilPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <Sidebar active="perfil" />

        <section className="p-4 md:p-8">
          <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-br from-[#21140e] to-[#15110f] p-5 md:p-8">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row">
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#ff8a3d] text-4xl font-black text-[#21140e]">
                  C
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
                    Perfil do aluno
                  </p>

                  <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                    Carlos Eduardo
                  </h2>

                  <p className="mt-2 text-[#b9aaa0]">
                    @carlos · 2º Informática · Aluno
                  </p>

                  <p className="mt-5 max-w-2xl leading-7 text-[#b9aaa0]">
                    Criador do Bonfire, interessado em programação, design,
                    banco de dados e projetos que conectam os alunos da escola.
                  </p>
                </div>
              </div>

              <button className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">
                Editar perfil
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-2xl font-bold">Publicações recentes</h3>

                <a className="shrink-0 text-sm text-[#ffd19a]" href="#">
                  Ver todas
                </a>
              </div>

              <div className="grid gap-3">
                {profilePosts.map((post) => (
                  <article
                    key={post.title}
                    className="rounded-xl border border-white/10 bg-white/[0.045] p-5"
                  >
                    <span className="mb-3 inline-block rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-sm text-[#ffd19a]">
                      {post.category}
                    </span>

                    <h4 className="text-xl font-bold">{post.title}</h4>

                    <p className="mt-2 text-sm text-[#7d7068]">
                      {post.comments} comentários · {post.time}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <aside>
              <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.045] p-5">
                <h3 className="mb-4 text-xl font-bold">Participação</h3>

                <Stat label="Tópicos criados" value="12" />
                <Stat label="Comentários" value="48" />
                <Stat label="Dúvidas ajudadas" value="9" />
              </section>

              <section className="rounded-xl border border-white/10 bg-white/[0.045] p-5">
                <h3 className="mb-4 text-xl font-bold">Atividade recente</h3>

                <div className="space-y-4">
                  {profileActivities.map((activity) => (
                    <p
                      key={activity}
                      className="border-b border-white/10 pb-4 text-sm leading-6 text-[#b9aaa0] last:border-0 last:pb-0"
                    >
                      {activity}
                    </p>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 py-3 last:border-0">
      <span className="text-sm text-[#b9aaa0]">{label}</span>
      <strong className="text-2xl">{value}</strong>
    </div>
  );
}