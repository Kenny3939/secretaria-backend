'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Appt = {
  id: string;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'completed' | 'no-show' | 'cancelled';
  client_name: string | null;
  phone_number: string;
  service_name: string;
};

type Mode = 'day' | 'week' | 'month';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function AgendaPage() {
  const [mode, setMode] = useState<Mode>('week');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [items, setItems] = useState<Appt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const base = new Date(`${date}T00:00:00.000Z`);
    if (mode === 'day') {
      const from = new Date(base);
      const to = new Date(base);
      to.setDate(to.getDate() + 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (mode === 'week') {
      const fromD = startOfWeek(base);
      const toD = new Date(fromD);
      toD.setDate(toD.getDate() + 7);
      return { from: fromD.toISOString(), to: toD.toISOString() };
    }
    const fromD = startOfMonth(base);
    const toD = new Date(fromD);
    toD.setMonth(toD.getMonth() + 1);
    return { from: fromD.toISOString(), to: toD.toISOString() };
  }, [date, mode]);

  useEffect(() => {
    setError(null);
    apiFetch<{ ok: true; appointments: Appt[] }>(`/api/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
      .then((r) => setItems(r.appointments))
      .catch(() => setError('No se pudieron cargar las citas.'));
  }, [range.from, range.to]);

  async function setStatus(id: string, status: Appt['status']) {
    const prev = items;
    setItems((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await apiFetch(`/api/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch {
      setItems(prev);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Vista diaria, semanal y mensual. Marcar completadas o no asistidas.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('day')}
              className={`rounded-xl px-3 py-2 text-sm ${mode === 'day' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black' : 'border border-zinc-200 dark:border-zinc-800'}`}
              type="button"
            >
              Día
            </button>
            <button
              onClick={() => setMode('week')}
              className={`rounded-xl px-3 py-2 text-sm ${mode === 'week' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black' : 'border border-zinc-200 dark:border-zinc-800'}`}
              type="button"
            >
              Semana
            </button>
            <button
              onClick={() => setMode('month')}
              className={`rounded-xl px-3 py-2 text-sm ${mode === 'month' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black' : 'border border-zinc-200 dark:border-zinc-800'}`}
              type="button"
            >
              Mes
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
          />
        </div>
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Sin citas en este rango.
          </div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{a.service_name}</div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {a.client_name || '(sin nombre)'} · {a.phone_number}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(a.start_datetime).toLocaleString()} → {new Date(a.end_datetime).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">{a.status}</span>
                  <button
                    onClick={() => setStatus(a.id, 'completed')}
                    className="rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-500"
                    type="button"
                  >
                    Completada
                  </button>
                  <button
                    onClick={() => setStatus(a.id, 'no-show')}
                    className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500"
                    type="button"
                  >
                    No asistió
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

