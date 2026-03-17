'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Notification = {
  id: string;
  type: string;
  message: string;
  appointment_id: string | null;
  created_at: string;
};

export default function NotificacionesPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    apiFetch<{ ok: true; notifications: Notification[] }>('/api/notifications')
      .then((r) => setItems(r.notifications))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // SSE uses cookies; must point to API base.
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    const es = new EventSource(`${base}/api/notifications/stream`, { withCredentials: true } as any);
    esRef.current = es;

    es.addEventListener('notification', (ev: MessageEvent) => {
      try {
        const n = JSON.parse(ev.data) as Notification;
        setItems((prev) => [n, ...prev].slice(0, 200));
      } catch {}
    });
    return () => {
      es.close();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notificaciones</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Cancelaciones y eventos en tiempo real.</p>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Sin notificaciones.
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">{new Date(n.created_at).toLocaleString()}</div>
              <div className="mt-1 text-sm">{n.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

