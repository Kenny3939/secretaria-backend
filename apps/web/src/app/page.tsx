export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Secretaria Virtual</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Accede al panel administrativo para gestionar agenda, clientes, servicios y configuración.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex w-fit items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
        >
          Ir al Login
        </a>
      </div>
    </div>
  );
}
