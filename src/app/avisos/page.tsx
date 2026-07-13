import Sidebar from "@/components/Sidebar";
import { noticeFilters, notices } from "@/data/mockData";

export default function AvisosPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <Sidebar active="avisos" />

        <section className="p-4 md:p-8">
          <header className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
                Avisos
              </p>

              <h2 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
                Comunicados oficiais do colégio.
              </h2>

              <p className="mt-4 max-w-2xl text-[#b9aaa0]">
                Prazos, reuniões, provas, eventos e comunicados importantes em
                um só lugar.
              </p>
            </div>

            <button className="rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e]">
              Criar aviso
            </button>
          </header>

          <div className="mb-6 flex flex-wrap gap-2">
            {noticeFilters.map((filter, index) => (
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

          <div className="grid gap-4">
            {notices.map((notice) => (
              <article
                key={notice.title}
                className="rounded-xl border border-white/10 bg-white/[0.045] p-5 md:p-6"
              >
                <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row">
                  <div>
                    <span className="mb-3 inline-block rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-sm font-semibold text-[#ffd19a]">
                      {notice.type}
                    </span>

                    <h3 className="text-2xl font-bold">{notice.title}</h3>

                    <p className="mt-2 text-sm text-[#7d7068]">
                      {notice.author} · {notice.target} · {notice.date}
                    </p>
                  </div>

                  <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#ffd19a]">
                    Ver detalhes
                  </button>
                </div>

                <p className="max-w-4xl leading-7 text-[#b9aaa0]">
                  {notice.content}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}