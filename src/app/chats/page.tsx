"use client";

import ChatMessage from "@/components/ChatMessage";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Room = { id: string; name: string; description: string | null };
type Author = { display_name: string | null; username: string | null };
type Message = { id: string; content: string; created_at: string; updated_at: string; author_id: string; author: Author | null };

function authorName(author: Author | null) {
  return author?.display_name || author?.username || "Usuário";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ChatsPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [content, setContent] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [messageActionId, setMessageActionId] = useState("");
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  const loadMessages = useCallback(async () => {
    if (!selectedRoomId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const { data: messageData, error } = await supabase
      .from("chat_messages")
      .select("id, content, created_at, updated_at, author_id")
      .eq("room_id", selectedRoomId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      setErrorMessage(`Não foi possível carregar as mensagens: ${error.message}`);
      setLoadingMessages(false);
      return;
    }

    const authorIds = [...new Set((messageData ?? []).map((message) => message.author_id))];
    const { data: profileData, error: profilesError } = authorIds.length
      ? await supabase.from("profiles").select("id, display_name, username").in("id", authorIds)
      : { data: [], error: null };

    if (profilesError) setErrorMessage(`Não foi possível carregar os autores: ${profilesError.message}`);
    const authors = new Map((profileData ?? []).map((profile) => [profile.id, profile]));
    setMessages((messageData ?? []).map((message) => ({ ...message, author: authors.get(message.author_id) ?? null })));
    setLoadingMessages(false);
  }, [selectedRoomId]);

  useEffect(() => {
    async function loadChat() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(userData.user.id);
      const { data, error } = await supabase.from("chat_rooms").select("id, name, description").order("name");
      if (error) {
        setErrorMessage(`Não foi possível carregar as salas: ${error.message}`);
      } else {
        setRooms(data ?? []);
        setSelectedRoomId((current) => current || data?.[0]?.id || "");
      }
      setLoadingRooms(false);
    }
    loadChat();
  }, [router]);

  useEffect(() => {
    setErrorMessage("");
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!selectedRoomId) return;
    const channel = supabase
      .channel(`chat:${selectedRoomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoomId}` }, () => loadMessages())
      .subscribe();
    // Uma remoção deixa de passar na RLS e pode não gerar evento para esta sessão.
    const refresh = () => { void loadMessages(); };
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [selectedRoomId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const cleanContent = content.trim();
    if (!selectedRoomId || cleanContent.length < 1 || cleanContent.length > 2000) {
      setErrorMessage("A mensagem deve ter entre 1 e 2000 caracteres.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      router.push("/login");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({ room_id: selectedRoomId, author_id: userData.user.id, content: cleanContent });
    setSending(false);
    if (error) {
      setErrorMessage(`Não foi possível enviar a mensagem: ${error.message}`);
      return;
    }
    setContent("");
    await loadMessages();
  }

  async function handleEditMessage(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    const cleanContent = editContent.trim();
    if (cleanContent.length < 1 || cleanContent.length > 2000) {
      setErrorMessage("A mensagem deve ter entre 1 e 2000 caracteres.");
      return;
    }
    setMessageActionId(messageId);
    const { data, error } = await supabase.from("chat_messages").update({ content: cleanContent, updated_at: new Date().toISOString() }).eq("id", messageId).select("id").maybeSingle();
    setMessageActionId("");
    if (error) {
      setErrorMessage(`Não foi possível editar a mensagem: ${error.message}`);
      return;
    }
    if (!data) { setErrorMessage("A mensagem foi removida ou seu acesso mudou. Atualize a conversa."); return; }
    setEditingMessageId("");
    setEditContent("");
    await loadMessages();
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm("Excluir esta mensagem? Esta ação não pode ser desfeita.")) return;
    setMessageActionId(messageId);
    const { data, error } = await supabase.from("chat_messages").delete().eq("id", messageId).select("id").maybeSingle();
    setMessageActionId("");
    if (error) {
      setErrorMessage(`Não foi possível excluir a mensagem: ${error.message}`);
      return;
    }
    if (!data) { setErrorMessage("A mensagem foi removida ou seu acesso mudou. Atualize a conversa."); return; }
    await loadMessages();
  }

  return (
    <main className="min-h-screen bg-[#11100f] text-[#f6efe7]">
      <section className="app-shell grid min-h-screen xl:grid-cols-[260px_320px_1fr]">
        <Sidebar active="chats" showRooms={false} />
        <aside className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">Chats</p>
          <h1 className="mb-5 text-3xl font-black">Salas</h1>
          <div className="flex gap-3 overflow-x-auto pb-2 xl:grid xl:grid-cols-1 xl:overflow-visible">
            {loadingRooms ? <p className="text-sm text-[#b9aaa0]">Carregando salas...</p> : rooms.length ? rooms.map((room) => (
              <button type="button" key={room.id} onClick={() => setSelectedRoomId(room.id)} className={`w-52 shrink-0 rounded-xl border p-4 xl:w-auto text-left ${selectedRoomId === room.id ? "border-[#ff8a3d]/50 bg-[#ff8a3d]/10" : "border-white/10 bg-white/[.045] hover:border-white/20"}`}>
                <strong>{room.name}</strong>
                <p className="mt-2 text-sm text-[#b9aaa0]">{room.description || "Sala da comunidade"}</p>
              </button>
            )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-[#b9aaa0]">Nenhuma sala disponível.</p>}
          </div>
        </aside>

        <section className="grid h-[75dvh] min-h-[360px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden xl:h-dvh">
          <header className="border-b border-white/10 p-5">
            <h2 className="text-2xl font-bold">{selectedRoom ? `# ${selectedRoom.name}` : "Selecione uma sala"}</h2>
            <p className="text-sm text-[#b9aaa0]">{selectedRoom?.description || "Escolha uma sala para conversar."}</p>
          </header>
          <div aria-live="polite" className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-6">
            {errorMessage && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{errorMessage}</p>}
            {loadingMessages ? <p className="text-[#b9aaa0]">Carregando mensagens...</p> : messages.length ? messages.map((message) => (
              editingMessageId === message.id ? <form key={message.id} onSubmit={(event) => handleEditMessage(event, message.id)} className="ml-auto max-w-[85%] rounded-2xl bg-[#ff8a3d] p-3 text-[#21140e] md:max-w-[70%]"><textarea required maxLength={2000} rows={3} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="w-full resize-y rounded-lg border border-black/10 bg-white/40 px-3 py-2 outline-none"/><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setEditingMessageId("")} className="rounded-full border border-black/20 px-3 py-1.5 text-xs">Cancelar</button><button disabled={messageActionId === message.id || !editContent.trim()} className="rounded-full bg-[#21140e] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Salvar</button></div></form> : <ChatMessage key={message.id} reportId={message.id} name={message.author_id === currentUserId ? "Você" : authorName(message.author)} text={message.content} time={`${formatTime(message.created_at)}${message.updated_at !== message.created_at ? " · editada" : ""}`} mine={message.author_id === currentUserId} onEdit={message.author_id === currentUserId ? () => { setEditingMessageId(message.id); setEditContent(message.content); setErrorMessage(""); } : undefined} onDelete={message.author_id === currentUserId ? () => handleDeleteMessage(message.id) : undefined} busy={messageActionId === message.id} />
            )) : selectedRoom ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[#b9aaa0]">Nenhuma mensagem ainda. Comece a conversa.</p> : null}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-3 border-t border-white/10 p-5">
            <input aria-label="Mensagem" value={content} onChange={(event) => setContent(event.target.value)} disabled={!selectedRoom || sending} maxLength={2000} className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none focus:border-[#ff8a3d] disabled:cursor-not-allowed disabled:opacity-50" placeholder={selectedRoom ? "Enviar mensagem..." : "Selecione uma sala"} />
            <button type="submit" aria-label="Enviar mensagem" disabled={!selectedRoom || sending || !content.trim()} className="h-12 w-12 shrink-0 rounded-full bg-[#ff8a3d] text-xl font-black text-[#21140e] disabled:cursor-not-allowed disabled:opacity-50">{sending ? "…" : "›"}</button>
          </form>
        </section>
      </section>
    </main>
  );
}
