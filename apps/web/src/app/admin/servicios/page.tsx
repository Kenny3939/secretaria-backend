'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Service = { id: string; name: string; price: string; duration_minutes: number; is_active: boolean };

export default function ServiciosPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await apiFetch<{ ok: true; services: Service[] }>('/api/services');
    setItems(r.services);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function create() {
    setBusy(true);
    try {
      await apiFetch('/api/services', {
        method: 'POST',
        body: JSON.stringify({ name, price, durationMinutes }),
      });
      setName('');
      setPrice(0);
      setDurationMinutes(30);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: Service) {
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await apiFetch(`/api/services/${s.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !s.is_active }) });
    } catch {
      setItems(prev);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Servicios</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Catálogo: crear, editar y activar/desactivar.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del servicio"
            className="rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
          />
          <input
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            type="number"
            min={0}
            step="0.01"
            placeholder="Precio"
            className="rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
          />
          <input
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            type="number"
            min={5}
            step={5}
            placeholder="Duración (min)"
            className="rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
          />
          <button
            onClick={create}
            disabled={busy || !name.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
            type="button"
          >
            Crear
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 md:flex-row md:items-center">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Q{s.price} · {s.duration_minutes} min
              </div>
            </div>
            <button
              onClick={() => toggle(s)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium',
                s.is_active
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700',
              ].join(' ')}
              type="button"
            >
              {s.is_active ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

