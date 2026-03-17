'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { apiFetch } from '@/lib/api';
import type { MeResponse, UserRole } from '@/lib/auth';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={[
        'rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme, setTheme, systemTheme } = useTheme();
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<MeResponse>('/api/auth/me')
      .then((r) => setMe(r.user))
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const role: UserRole | null = me?.role ?? null;
  const effectiveTheme = useMemo(() => theme === 'system' ? systemTheme : theme, [theme, systemTheme]);

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-black">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[240px_1fr] md:px-6 md:py-6">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-6 md:h-[calc(100dvh-48px)]">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="text-sm font-semibold">Secretaria Virtual</div>
            <button
              className="rounded-xl border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
              type="button"
            >
              {effectiveTheme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <NavLink href="/admin" label="Dashboard" />
            <NavLink href="/admin/agenda" label="Agenda" />
            <NavLink href="/admin/clientes" label="Clientes (CRM)" />
            <NavLink href="/admin/servicios" label="Servicios" />
            <NavLink href="/admin/configuracion" label="Configuración" />
            <NavLink href="/admin/notificaciones" label="Notificaciones" />
          </div>
          <div className="mt-6 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
            <div className="font-medium text-zinc-800 dark:text-zinc-100">{me?.email}</div>
            <div className="mt-1">Rol: {role}</div>
            <button onClick={logout} className="mt-2 text-xs font-medium text-zinc-900 underline dark:text-zinc-50" type="button">
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

