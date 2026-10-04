import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-bold">Welcome back</h1>
        <p className="mb-6 text-sm text-ink-muted">Log in to manage your shop&apos;s stock.</p>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </Card>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New shop?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
          Create a free account
        </Link>
      </p>
    </>
  );
}
