"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface RealtimeActivity {
  id: string;
  tenantId: string;
  type: string;
  customerName: string | null;
  message: string;
  createdAt: string;
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

/**
 * Connects to the Flavourly realtime mini-service via the gateway.
 *
 * The URL is RELATIVE and uses the `XTransformPort=3033` query param —
 * NEVER a direct `http://localhost:3033` URL. The Caddy gateway inspects
 * the query param and forwards the WebSocket upgrade to the mini-service.
 */
export function useRealtimeActivity(tenantId?: string) {
  const [items, setItems] = useState<RealtimeActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("/?XTransformPort=3033", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("activity:initial", (data: RealtimeActivity[]) => {
      if (Array.isArray(data)) {
        setItems(data);
      }
    });

    socket.on("activity:new", (item: RealtimeActivity) => {
      if (!item || typeof item.id !== "string") return;
      setItems((prev) => {
        // De-dupe in case of a watermark race on reconnect.
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev].slice(0, 50);
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const filtered = tenantId
    ? items.filter((i) => i.tenantId === tenantId)
    : items;

  return { items: filtered, connected };
}

/**
 * Subscribe to ALL webhook events (for the super-admin Webhooks view).
 * Returns the latest 50 received since mount plus any pushed in real time.
 */
export function useRealtimeWebhooks() {
  const [items, setItems] = useState<RealtimeWebhook[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("/?XTransformPort=3033", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("webhook:new", (item: RealtimeWebhook) => {
      if (!item || typeof item.id !== "string") return;
      setItems((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev].slice(0, 50);
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { items, connected };
}
