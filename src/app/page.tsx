import Link from "next/link";
import ChatMessage from "@/components/ChatMessage";
import NoticePreview from "@/components/NoticePreview";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { homePosts } from "@/data/mockData";

const homeChatMessages = [
  {
    name: "Gabi",
    text: "Alguém vai ficar depois da aula pra terminar o protótipo?",
    mine: false,
  },
  {
    name: "Pedro",
    text: "Eu fico. Também preciso ajustar a tela de login.",
    mine: false,
  },
  {
    name: "Você",
    text: "Bora fazer o Bonfire ficar apresentável hoje.",
    mine: true,
  },
  {
    name: "Marina",
    text: "Vou mandar umas ideias de categorias pro fórum.",
    mine: false,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr_340px]">
        <Sidebar active="inicio" />

        <section className="p-4 md:p-6">
          <header className="mb-6 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
            <input
              className="w-full max-w-xl rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none placeholder:text-[#7d7068] focus:border-[#ff8a3d]"
              placeholder="Buscar tópicos, alunos, salas..."
            />

            <div className="flex items-center justify-between gap-3 text-[#b9aaa0] md:justify-start">
              <span>Carlos, 2º ano</span>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8a3d] font-bold text-[#21140e]">
                C
              </div>
            </div>
          </header>

          <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#21140e] to-[#15110f] p-6 shadow-2xl md:p-8">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
              PPO 2026
            </p>

            <h2 className="max-w-3xl text-4xl font-black leading-none tracking-tight md:text-6xl">
              As conversas do colégio em um só lugar.
            </h2>

            <p className="mt-5 max-w-2xl text-[#b9aaa0]">
              Fóruns para dúvidas, chats por turma e avisos organizados para os
              alunos se ajudarem sem perder nada no caminho.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/foruns"
                className="rounded-full bg-[#ff8a3d] px-5 py-3 text-center font-bold text-[#21140e]"
              >
                Criar tópico
              </Link>

              <Link
                href="/chats"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center font-bold"
              >
                Entrar em uma sala
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">Tópicos em alta</h3>

                <Link className="text-sm text-[#ffd19a]" href="/foruns">
                  Ver todos
                </Link>
              </div>

              <div className="space-y-3">
                {homePosts.map((post) => (
                  <PostCard
                    key={post.title}
                    name={post.name}
                    title={post.title}
                    meta={post.meta}
                    text={post.text}
                    tags={post.tags}
                  />
                ))}
              </div>
            </section>

            <aside className="border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="mb-4 text-xl font-bold">Hoje</h3>

              <StatCard label="Alunos online" value="128" />
              <StatCard label="Tópicos novos" value="16" />
              <StatCard label="Dúvidas resolvidas" value="43" />

              <h3 className="mb-4 mt-8 text-xl font-bold">Avisos</h3>

              <NoticePreview
                title="Entrega do relatório PPO"
                text="Prazo final: quinta-feira, 18h."
              />

              <NoticePreview
                title="Reunião dos representantes"
                text="Hoje no intervalo, sala 04."
              />

              <NoticePreview
                title="Simulado ENEM"
                text="Sábado às 8h, bloco principal."
              />
            </aside>
          </div>
        </section>

        <aside className="grid min-h-[520px] grid-rows-[auto_1fr_auto] border-t border-white/10 bg-black/10 xl:h-screen xl:border-l xl:border-t-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-xl font-bold"># 2º informática</h3>
            <p className="text-sm text-[#b9aaa0]">Chat da turma · 32 online</p>
          </div>

          <div className="space-y-3 overflow-auto p-5">
            {homeChatMessages.map((message, index) => (
              <ChatMessage
                key={`${message.name}-${index}`}
                name={message.name}
                text={message.text}
                mine={message.mine}
                compact
              />
            ))}
          </div>

          <div className="flex gap-2 border-t border-white/10 p-4">
            <input
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-[#7d7068]"
              placeholder="Enviar mensagem..."
            />

            <button className="h-12 w-12 rounded-full bg-[#ff8a3d] font-black text-[#21140e]">
              ›
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}