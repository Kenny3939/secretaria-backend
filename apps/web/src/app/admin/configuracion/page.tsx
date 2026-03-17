'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type SettingsResponse = {
  ok: true;
  business: { id: string; name: string; open_time: string; close_time: string; capacity: number };
  settings: { buffer_minutes: number; off_hours_message: string | null };
};

export default function ConfiguracionPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<SettingsResponse>('/api/settings')
      .then(setData)
      .catch(() => {});
  }, []);

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          openTime: data.business.open_time,
          closeTime: data.business.close_time,
          capacity: data.business.capacity,
          bufferMinutes: data.settings.buffer_minutes,
          offHoursMessage: data.settings.off_hours_message,
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-400">Cargando configuración…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Horario, buffers, capacidad, recordatorios y mensaje fuera de horario.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-sm font-semibold">Horario</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Abre</label>
              <input
                type="time"
                value={data.business.open_time?.slice(0, 5) || '08:00'}
                onChange={(e) => setData({ ...data, business: { ...data.business, open_time: e.target.value } })}
                className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-600 dark:text-zinc-400">Cierra</label>
              <input
                type="time"
                value={data.business.close_time?.slice(0, 5) || '18:00'}
                onChange={(e) => setData({ ...data, business: { ...data.business, close_time: e.target.value } })}
                className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <label className="text-xs text-zinc-600 dark:text-zinc-400">Capacidad (empleados)</label>
            <input
              type="number"
              min={1}
              value={data.business.capacity}
              onChange={(e) => setData({ ...data, business: { ...data.business, capacity: Number(e.target.value) } })}
              className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-sm font-semibold">Buffers y fuera de horario</div>
          <div className="mt-3 space-y-1">
            <label className="text-xs text-zinc-600 dark:text-zinc-400">Buffer (minutos)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={data.settings.buffer_minutes ?? 0}
              onChange={(e) => setData({ ...data, settings: { ...data.settings, buffer_minutes: Number(e.target.value) } })}
              className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
            />
          </div>
          <div className="mt-3 space-y-1">
            <label className="text-xs text-zinc-600 dark:text-zinc-400">Mensaje fuera de horario</label>
            <textarea
              value={data.settings.off_hours_message || ''}
              onChange={(e) => setData({ ...data, settings: { ...data.settings, off_hours_message: e.target.value } })}
              rows={6}
              className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
            />
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
        type="button"
      >
        {busy ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  );
}

