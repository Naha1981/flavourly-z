"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { timeAgo } from "@/lib/flavourly";

export interface RealtimeActivity {
  id: string;
  tenantId: string;
  type: string;
  customerName: string | null;
  message: string;
  createdAt: string;
  timeAgo?: string;
  emoji?: string;
}

export interface RealtimeWebhook {
  id: string;
  tenantId: string | null;
  instanceName: string;
  eventType: string;
  phoneNumber: string | null;
  messageContent: string | null;
  status: string;
  createdAt: string;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  joined: "🎉",
  redeemed: "🎁",
  earned: "✨",
  visit: "👣",
  campaign_sent: "📣",
  added: "👤",
};

/**
 * Realtime activity feed hook with REST polling fallback.
 *
 * Tries to connect to the Flavourly realtime WebSocket mini-service first.
 * If the connection fails (e.g. on Vercel where the mini-service can't run),
 * it automatically falls back to polling /api/activity every 15 seconds.
 */
export function useRealtimeActivity(tenantId?: string) {
  const [items, setItems] = useState<RealtimeActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let fallbackStarted = false;

    const startFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      setUsingFallback(true);
      setConnected(false);

      // Initial fetch
      const poll = async () => {
        try {
          const res = await fetch("/api/activity?limit=20");
          if (!res.ok) return;
          const data = await res.json();
          const newItems: RealtimeActivity[] = (data.items ?? []).map(
            (a: RealtimeActivity & { createdAt: string }) => ({
              ...a,
              emoji: ACTIVITY_EMOJI[a.type] ?? "•",
              timeAgo: timeAgo(a.createdAt),
            })
          );
          if (cancelled) return;
          setItems(newItems);
        } catch {
          // silent
        }
      };
      poll();
      fallbackTimerRef.current = setInterval(poll, 15000);
    };

    // Try WebSocket first
    try {
      const socket = io("/?XTransformPort=3033", {
        transports: ["websocket"],
        reconnection: false, // don't endlessly retry — fall back to polling
        timeout: 3000,
      });
      socketRef.current = socket;

      const fallbackTimer = setTimeout(() => {
        if (!socket.connected) {
          socket.removeAllListeners();
          socket.disconnect();
          socketRef.current = null;
          startFallback();
        }
      }, 3500);

      socket.on("connect", () => {
        clearTimeout(fallbackTimer);
        if (cancelled) return;
        setConnected(true);
        setUsingFallback(false);
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", () => {
        clearTimeout(fallbackTimer);
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        startFallback();
      });

      socket.on("activity:initial", (data: RealtimeActivity[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const enriched = data.map((a) => ({
          ...a,
          emoji: ACTIVITY_EMOJI[a.type] ?? "•",
          timeAgo: timeAgo(a.createdAt),
        }));
        enriched.forEach((a) => seenIdsRef.current.add(a.id));
        setItems(enriched);
      });

      socket.on("activity:new", (item: RealtimeActivity) => {
        if (cancelled || !item || typeof item.id !== "string") return;
        if (seenIdsRef.current.has(item.id)) return;
        seenIdsRef.current.add(item.id);
        const enriched = {
          ...item,
          emoji: ACTIVITY_EMOJI[item.type] ?? "•",
          timeAgo: timeAgo(item.createdAt),
        };
        setItems((prev) => [enriched, ...prev].slice(0, 50));
      });
    } catch {
      startFallback();
    }

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, []);

  const filtered = tenantId
    ? items.filter((i) => i.tenantId === tenantId)
    : items;

  return { items: filtered, connected, usingFallback };
}

/**
 * Subscribe to ALL webhook events (for the super-admin Webhooks view).
 * Falls back to REST polling if WebSocket is unavailable.
 */
export function useRealtimeWebhooks() {
  const [items, setItems] = useState<RealtimeWebhook[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let fallbackStarted = false;

    const startFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      const poll = async () => {
        try {
          const res = await fetch("/api/webhooks?limit=50");
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled) return;
          setItems(data.events ?? []);
        } catch {
          // silent
        }
      };
      poll();
      fallbackTimerRef.current = setInterval(poll, 5000);
    };

    try {
      const socket = io("/?XTransformPort=3033", {
        transports: ["websocket"],
        reconnection: false,
        timeout: 3000,
      });
      socketRef.current = socket;

      const fallbackTimer = setTimeout(() => {
        if (!socket.connected) {
          socket.removeAllListeners();
          socket.disconnect();
          socketRef.current = null;
          startFallback();
        }
      }, 3500);

      socket.on("connect", () => {
        clearTimeout(fallbackTimer);
        if (cancelled) return;
        setConnected(true);
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", () => {
        clearTimeout(fallbackTimer);
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        startFallback();
      });

      socket.on("webhook:new", (item: RealtimeWebhook) => {
        if (cancelled || !item || typeof item.id !== "string") return;
        setItems((prev) => {
          if (prev.some((p) => p.id === item.id)) return prev;
          return [item, ...prev].slice(0, 50);
        });
      });
    } catch {
      startFallback();
    }

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, []);

  return { items, connected };
}
