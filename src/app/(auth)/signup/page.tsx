import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your shop" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-bold">Set up your shop</h1>
        <p className="mb-6 text-sm text-ink-muted">Takes less than a minute. No card needed.</p>
        <SignupForm />
      </Card>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
