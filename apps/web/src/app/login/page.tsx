'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in, go to admin.
    apiFetch('/api/auth/me')
      .then(() => router.replace('/admin'))
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.replace('/admin');
    } catch (e: any) {
      setError('Credenciales inválidas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Panel Administrativo</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Ingresa con tu usuario y contraseña.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              placeholder="admin@empresa.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
          Modo oscuro/claro respeta tu sistema. Puedes cambiarlo dentro del panel.
        </p>
      </div>
    </div>
  );
}

