'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Notification = { id: string; type: string; message: string; created_at: string };

export default function DashboardPage() {
  const [notis, setNotis] = useState<Notification[]>([]);

  useEffect(() => {
    apiFetch<{ ok: true; notifications: Notification[] }>('/api/notifications')
      .then((r) => setNotis(r.notifications.slice(0, 5)))
      .catch(() => {});
  }, []);

  const cancels = useMemo(() => notis.filter((n) => n.type === 'cancellation').length, [notis]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vista general: ingresos, asistencia y cancelaciones recientes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Ingresos proyectados</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Ingresos reales</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Tasa de asistencia</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Cancelaciones recientes</div>
          <div className="mt-2 text-2xl font-semibold">{cancels}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Últimas cancelaciones</h2>
          <a className="text-xs underline" href="/admin/notificaciones">
            Ver todo
          </a>
        </div>
        <div className="mt-3 space-y-2">
          {notis.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Sin notificaciones.</div>
          ) : (
            notis.map((n) => (
              <div key={n.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/40">
                {n.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

