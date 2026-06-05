import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <div className="max-w-xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-500">
          Hairstyling
        </p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight text-neutral-900">
          Paradiso
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Unsere Online-Terminbuchung ist gerade im Aufbau. Schon bald kannst du
          hier deinen Termin bei deinem Lieblingsfriseur buchen.
        </p>
        <p className="mt-3 text-sm text-neutral-400">
          München · Tel. 089&nbsp;-&nbsp;32&nbsp;66&nbsp;81&nbsp;82
        </p>
      </div>
      <Link
        href="/book"
        className="mt-10 rounded-full bg-orange-500 px-8 py-3 text-base font-medium text-white shadow-sm transition hover:bg-orange-600"
      >
        Jetzt Termin buchen
      </Link>
      <Link
        href="/admin"
        className="mt-6 text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-600"
      >
        Adminbereich
      </Link>
    </main>
  );
}
