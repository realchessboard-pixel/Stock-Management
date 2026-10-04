import "server-only";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export type OnboardingStep = { key: string; label: string; done: boolean; href?: string };

/** Derives first-run progress from real data — nothing is stored separately. */
export async function getOnboardingProgress(ctx: TenantContext): Promise<{ steps: OnboardingStep[]; complete: boolean }> {
  const where = { businessId: ctx.businessId };
  const [products, openings, barcodes] = await Promise.all([
    db.product.count({ where }),
    db.stockMovement.count({ where: { ...where, type: "OPENING" } }),
    db.barcode.count({ where }),
  ]);
  const steps: OnboardingStep[] = [
    { key: "business", label: "Create your shop", done: true },
    { key: "owner", label: "Add owner details", done: true },
    { key: "product", label: "Add your first product", done: products > 0, href: "/products/new" },
    { key: "opening", label: "Set opening stock", done: openings > 0, href: "/products" },
    { key: "barcode", label: "Generate a barcode", done: barcodes > 0, href: "/products" },
    { key: "label", label: "Print a barcode label", done: barcodes > 0 && openings > 0, href: "/products" },
  ];
  return { steps, complete: steps.every((s) => s.done) };
}
