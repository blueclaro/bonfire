import ChatMessage from "@/components/ChatMessage";
import Sidebar from "@/components/Sidebar";
import { chatMessages, chatParticipants, chatRooms } from "@/data/mockData";

export default function ChatsPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_320px_1fr] 2xl:grid-cols-[260px_330px_1fr_260px]">
        <Sidebar active="chats" showRooms={false} />

        <aside className="border-b border-white/10 p-4 md:p-5 xl:border-b-0 xl:border-r">
          <div className="mb-6">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ffd19a]">
              Chats
            </p>

            <h2 className="text-3xl font-black">Salas</h2>
          </div>

          <input
            className="mb-5 w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-[#7d7068] focus:border-[#ff8a3d]"
            placeholder="Buscar sala..."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {chatRooms.map((room) => (
              <button
                key={room.name}
                className={`w-full rounded-xl border p-4 text-left transition hover:border-[#ff8a3d]/40 ${
                  room.active
                    ? "border-[#ff8a3d]/50 bg-[#ff8a3d]/10"
                    : "border-white/10 bg-white/[0.045]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <strong>{room.name}</strong>

                  <span className="shrink-0 rounded-full bg-[#75d19a]/10 px-2 py-1 text-xs text-[#75d19a]">
                    {room.online} online
                  </span>
                </div>

                <p className="text-sm text-[#b9aaa0]">{room.description}</p>

                <p className="mt-3 truncate text-xs text-[#7d7068]">
                  {room.lastMessage}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid min-h-[620px] grid-rows-[auto_1fr_auto] xl:min-h-screen">
          <header className="border-b border-white/10 p-4 md:p-5">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold"># 2º Informática</h2>

                <p className="mt-1 text-sm text-[#b9aaa0]">
                  Chat principal da turma · 32 online
                </p>
              </div>

              <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#ffd19a]">
                Detalhes
              </button>
            </div>
          </header>

          <div className="space-y-4 overflow-auto p-4 md:p-6">
            {chatMessages.map((message, index) => (
              <ChatMessage
                key={`${message.name}-${index}`}
                name={message.name}
                text={message.text}
                mine={message.mine}
              />
            ))}
          </div>

          <div className="border-t border-white/10 p-4 md:p-5">
            <div className="flex gap-3">
              <input
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none placeholder:text-[#7d7068] focus:border-[#ff8a3d]"
                placeholder="Enviar mensagem..."
              />

              <button className="h-12 w-12 shrink-0 rounded-full bg-[#ff8a3d] text-xl font-black text-[#21140e]">
                ›
              </button>
            </div>
          </div>
        </section>

        <aside className="border-t border-white/10 p-4 md:p-5 2xl:border-l 2xl:border-t-0">
          <h3 className="mb-4 text-xl font-bold">Participantes</h3>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-1">
            {chatParticipants.map((person) => (
              <div key={person} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-[#ffd19a]">
                  {person[0]}
                </div>

                <div>
                  <strong className="block text-sm">{person}</strong>
                  <span className="text-xs text-[#75d19a]">online</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="mb-3 text-xl font-bold">Sobre a sala</h3>

            <p className="text-sm leading-6 text-[#b9aaa0]">
              Espaço para conversas rápidas da turma, dúvidas sobre atividades e
              organização dos projetos.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}