import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="font-semibold text-brand-700 underline">
        Go home
      </Link>
    </div>
  );
}
