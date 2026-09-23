"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import ChatMessage from "@/components/ChatMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Room = { id: string; name: string; description: string | null };
type Message = {
  id: string; content: string; created_at: string; updated_at: string; author_id: string;
  author: { display_name: string | null; username: string | null } | null;
};

function Conversation({ room, userId }: { room: Room; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [connection, setConnection] = useState("Conectando...");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  const request = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    try {
      const result = await supabase.from("chat_messages")
        .select("id, content, created_at, updated_at, author_id, author:profiles!chat_messages_author_id_fkey(display_name, username)")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
      if (!active.current || version !== request.current) return;
      if (result.error) throw result.error;
      setMessages((result.data as unknown as Message[]).slice().reverse());
      setError("");
    } catch {
      if (active.current && version === request.current) {
        setMessages([]);
        setError("Não foi possível carregar a conversa.");
      }
    } finally {
      if (active.current && version === request.current) setLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    active.current = true;
    void refresh();
    const channel = supabase.channel("home-chat:" + userId + ":" + room.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: "room_id=eq." + room.id }, () => { void refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: "room_id=eq." + room.id }, () => { void refresh(); })
      // DELETE não oferece filtro por sala; o histórico é consultado novamente sob RLS.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, () => { void refresh(); })
      .subscribe(status => {
        if (!active.current) return;
        if (status === "SUBSCRIBED") {
          setConnection("Conectado"); void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("Conexão instável — atualização periódica ativa");
        }
      });
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => {
      active.current = false;
      request.current++;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      void supabase.removeChannel(channel);
    };
  }, [refresh, room.id, userId]);

  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = content.trim();
    if (busy.current || !clean || clean.length > 2000) return;
    busy.current = true; setSending(true); setSendError("");
    try {
      const auth = await supabase.auth.getUser();
      if (!active.current) return;
      if (auth.error || auth.data.user?.id !== userId) throw new Error("Sua sessão mudou. Entre novamente antes de enviar.");
      const result = await supabase.from("chat_messages").insert({
        room_id: room.id, author_id: auth.data.user.id, content: clean,
      });
      if (!active.current) return;
      if (result.error) throw new Error("Não foi possível enviar. Verifique a conexão e seu acesso à sala.");
      setContent(""); follow.current = true;
      await refresh();
    } catch (cause) {
      if (active.current) setSendError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      busy.current = false;
      if (active.current) setSending(false);
    }
  }

  return <>
    <div className="px-5 pt-3 text-xs text-[#b9aaa0]" role="status">{connection} · Últimas 50 mensagens</div>
    <div ref={scroll} onScroll={() => {
      const box = scroll.current;
      if (box) follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    }} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" aria-label="Histórico da sala">
      {loading ? <p role="status">Carregando mensagens...</p> : error ? <div role="alert" className="text-sm text-red-200">{error}<button type="button" onClick={() => void refresh()} className="mt-2 block underline">Tentar novamente</button></div> : messages.length ? messages.map(message =>
        <ChatMessage key={message.id} compact mine={message.author_id === userId} reportId={message.id}
          name={message.author_id === userId ? "Você" : message.author?.display_name || message.author?.username || "Usuário"}
          text={message.content}
          time={new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at)) + (message.updated_at !== message.created_at ? " · editada" : "")} />
      ) : <p className="text-sm text-[#b9aaa0]">Nenhuma mensagem ainda. Comece a conversa.</p>}
    </div>
    <form onSubmit={send} className="border-t border-white/10 p-4">
      {sendError && <p role="alert" className="mb-3 text-sm text-red-200">{sendError}</p>}
      <div className="flex gap-2">
        <input aria-label={"Mensagem para " + room.name} value={content} onChange={e => setContent(e.target.value)} disabled={sending} maxLength={2000} placeholder="Enviar mensagem..." className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 focus:outline-[#ff8a3d]" />
        <button type="submit" aria-label="Enviar mensagem" disabled={sending || !content.trim()} className="h-12 w-12 shrink-0 rounded-full bg-[#ff8a3d] font-black text-[#21140e] disabled:opacity-50">{sending ? "…" : "›"}</button>
      </div>
    </form>
  </>;
}

export default function HomeChat() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let version = 0;
    async function load() {
      const current = ++version;
      setStatus("loading"); setRooms([]); setUserId("");
      try {
        if (!isSupabaseConfigured) throw new Error("Configuração indisponível");
        const auth = await supabase.auth.getUser();
        if (!active || version !== current) return;
        if (!auth.data.user) {
          setStatus(auth.error && auth.error.name !== "AuthSessionMissingError" ? "error" : "signed-out"); return;
        }
        if (auth.error) throw auth.error;
        const result = await supabase.from("chat_rooms").select("id, name, description").order("name");
        if (!active || version !== current) return;
        if (result.error) throw result.error;
        setRooms(result.data ?? []);
        setRoomId(previous => result.data.some(room => room.id === previous) ? previous : result.data[0]?.id ?? "");
        setUserId(auth.data.user.id); setStatus("ready");
      } catch {
        if (active && version === current) setStatus("error");
      }
    }
    void load();
    let timer: ReturnType<typeof setTimeout>;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      version++; setStatus("loading"); setRooms([]); setUserId(""); setRoomId("");
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void load(); }, 0);
    });
    return () => { active = false; version++; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [retry]);
  const room = rooms.find(item => item.id === roomId);
  return <aside aria-label="Chat da página inicial" className="flex h-[600px] min-w-0 flex-col border-t border-white/10 bg-black/10 xl:sticky xl:top-0 xl:h-screen xl:border-l xl:border-t-0">
    <header className="border-b border-white/10 p-5">
      <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">Chat</h3><Link href="/chats" className="text-sm text-[#ffd19a] hover:underline">Abrir chats</Link></div>
      {status === "ready" && rooms.length > 0 && <label className="mt-3 block text-sm text-[#b9aaa0]">Sala
        <select value={roomId} onChange={e => setRoomId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#181513] p-2 text-white">
          {rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      {room?.description && <p className="mt-2 text-sm text-[#b9aaa0]">{room.description}</p>}
    </header>
    {status === "loading" && <p role="status" className="p-5 text-sm text-[#b9aaa0]">Carregando salas...</p>}
    {status === "signed-out" && <p className="p-5 text-sm"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para conversar.</p>}
    {status === "error" && <div role="alert" className="p-5 text-sm text-red-200">Não foi possível carregar as salas.<button onClick={() => setRetry(value => value + 1)} className="mt-2 block underline">Tentar novamente</button></div>}
    {status === "ready" && (room ? <Conversation key={userId + ":" + room.id} room={room} userId={userId} /> : <p className="p-5 text-sm text-[#b9aaa0]">Nenhuma sala disponível para você.</p>)}
  </aside>;
}
