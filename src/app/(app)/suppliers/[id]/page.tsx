import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone } from "lucide-react";
import { SupplierForm } from "@/components/catalog/supplier-form";
import { NoAccess } from "@/components/common/no-access";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { isAppError } from "@/lib/errors";
import { getSupplier } from "@/server/catalog/suppliers";
import { can } from "@/server/permissions";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage({ params, searchParams }: PageProps<"/suppliers/[id]">) {
  const { ctx, allowed } = await pageAccess("supplier.view");
  if (!allowed) return <NoAccess />;
  const { id } = await params;
  const { edit } = await searchParams;
  const supplier = await getSupplier(ctx, id).catch((e) => {
    if (isAppError(e)) return null;
    throw e;
  });
  if (!supplier) notFound();
  const canWrite = can(ctx, "supplier.write");

  if (edit === "1" && canWrite) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Edit supplier" subtitle={supplier.name} />
        <SupplierForm defaults={supplier} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={supplier.name}
        subtitle={supplier.company ?? undefined}
        actions={canWrite ? <ButtonLink href={`/suppliers/${supplier.id}?edit=1`} variant="secondary" size="md"><Pencil className="size-4" aria-hidden /> Edit</ButtonLink> : null}
      />
      {!supplier.isActive ? <Badge>Inactive</Badge> : null}
      <div className="grid grid-cols-2 gap-3">
        {supplier.phone ? (
          <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className={buttonClasses("secondary", "lg")}>
            <Phone className="size-5" aria-hidden /> Call
          </a>
        ) : null}
        {supplier.email ? (
          <a href={`mailto:${supplier.email}`} className={buttonClasses("secondary", "lg")}>
            <Mail className="size-5" aria-hidden /> Email
          </a>
        ) : null}
      </div>
      <Card>
        <dl className="divide-y divide-line text-sm">
          {(
            [
              ["Phone", supplier.phone],
              ["Email", supplier.email],
              ["GSTIN", supplier.gstin],
              ["Address", supplier.address],
              ["Notes", supplier.notes],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="whitespace-pre-line text-right font-medium">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Products from this supplier</h2>
        {supplier.products.length ? (
          <ul className="divide-y divide-line">
            {supplier.products.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="font-mono text-sm text-ink-muted">{p.sku}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No products have this supplier as their preferred supplier yet.</p>
        )}
        <p className="mt-3 text-xs text-ink-muted">Purchase history from this supplier will appear here once stock is received.</p>
      </Card>
    </div>
  );
}
