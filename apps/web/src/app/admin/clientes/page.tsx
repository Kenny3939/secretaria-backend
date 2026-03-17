'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Client = {
  id: string;
  name: string | null;
  phone_number: string;
  tag: 'Nuevo' | 'Frecuente' | 'VIP' | 'Pendiente' | null;
  internal_notes: string | null;
  created_at: string;
};

const TAGS: Array<Client['tag']> = [null, 'Nuevo', 'Frecuente', 'VIP', 'Pendiente'];

export default function ClientesPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const r = await apiFetch<{ ok: true; clients: Client[] }>(`/api/clients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setItems(r.clients);
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await apiFetch<{ ok: true; client: Client }>(`/api/clients/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: selected.name,
          tag: selected.tag,
          internalNotes: selected.internal_notes,
        }),
      });
      setSelected(r.client);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clientes (CRM)</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Directorio, etiquetas, notas internas e historial (vía citas).</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800 md:max-w-md"
        />
        <button
          onClick={() => refresh().catch(() => {})}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          type="button"
        >
          Buscar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className="w-full rounded-2xl border border-zinc-200 p-4 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{c.name || '(sin nombre)'}</div>
                <div className="text-xs text-zinc-500">{c.tag || '—'}</div>
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.phone_number}</div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-sm font-semibold">Ficha</div>
          {!selected ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Selecciona un cliente.</div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nombre</label>
                <input
                  value={selected.name || ''}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Etiqueta</label>
                <select
                  value={selected.tag || ''}
                  onChange={(e) => setSelected({ ...selected, tag: (e.target.value || null) as any })}
                  className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
                >
                  {TAGS.map((t) => (
                    <option key={String(t)} value={t || ''}>
                      {t || '—'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Notas internas</label>
                <textarea
                  value={selected.internal_notes || ''}
                  onChange={(e) => setSelected({ ...selected, internal_notes: e.target.value })}
                  rows={6}
                  className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
                />
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
                type="button"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

