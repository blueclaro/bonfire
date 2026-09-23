"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Notification = {
  id: string; kind: string; destination: string; message: string;
  reason: string | null; created_at: string; read_at: string | null;
};
const pageSize = 20;

export function useNotifications(withList = false, page = 0) {
  const instance = useId();
  const [userId, setUserId] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    owner: string; page: number; items: Notification[]; count: number | null;
    more: boolean; error: string;
  } | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let live = true;
    let changed = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (live) { setUserId(session?.user.id || ""); setAuthReady(true); }
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (live && !changed) { setUserId(data.user?.id || ""); setAuthReady(true); }
    }).catch(() => { if (live && !changed) setAuthReady(true); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) { setSnapshot(null); return; }
    let live = true;
    let version = 0;
    async function load() {
      const request = ++version;
      try {
        const [counter, list] = await Promise.all([
          supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", userId).is("read_at", null),
          withList ? supabase.from("notifications")
            .select("id,kind,destination,message,reason,created_at,read_at")
            .eq("recipient_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (!live || request !== version) return;
        if (counter.error || list.error) throw new Error();
        setSnapshot({ owner: userId, page, items: (list.data || []).slice(0, pageSize) as Notification[],
          more: (list.data || []).length > pageSize, count: counter.count ?? 0, error: "" });
      } catch {
        if (live && request === version) setSnapshot({ owner: userId, page, items: [], count: null, more: false,
          error: "Não foi possível carregar as notificações. Tente atualizar." });
      }
    }
    refreshRef.current = () => { void load(); };
    void load();
    const channel = supabase.channel("notifications:" + instance + ":" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "recipient_id=eq." + userId }, () => { void load(); })
      .subscribe(status => { if (status === "SUBSCRIBED") void load(); });
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    const interval = setInterval(refreshVisible, 30000);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("bonfire:notifications-read", refreshVisible);
    return () => {
      live = false; version++;
      refreshRef.current = () => {};
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("bonfire:notifications-read", refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId, page, withList, instance]);

  const current = snapshot?.owner === userId && snapshot.page === page ? snapshot : null;
  return { userId, authReady, loading: !authReady || (!!userId && !current),
    items: current?.items || [], count: current?.count ?? null,
    error: current?.error || "", hasMore: current?.more || false, refresh };
}
