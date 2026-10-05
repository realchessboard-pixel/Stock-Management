import "server-only";
import { db } from "@/server/db";
import { logInfo, logError } from "@/server/log";
import type { TenantContext } from "@/server/tenancy/context";

/**
 * Low-stock notification architecture.
 *
 * After a stock change commits, `notifyStockChange` checks whether the
 * product just CROSSED below its minimum (or hit zero) and hands an event to
 * every registered channel. Today only the in-app channel exists (the
 * dashboard and Low Stock screen read live data, so it just logs). WhatsApp,
 * email or push channels can be added by implementing `NotificationChannel`
 * and registering it — inventory code doesn't change.
 */
export type LowStockEvent = {
  businessId: string;
  productId: string;
  productName: string;
  unit: string;
  previous: number;
  current: number;
  minStock: number;
  level: "LOW" | "OUT";
};

export interface NotificationChannel {
  name: string;
  sendLowStock(event: LowStockEvent): Promise<void>;
}

const inApp: NotificationChannel = {
  name: "in-app",
  async sendLowStock(event) {
    logInfo("stock.low", event);
  },
};

const channels: NotificationChannel[] = [inApp];

export function registerChannel(channel: NotificationChannel) {
  channels.push(channel);
}

function level(qty: number, min: number): "OK" | "LOW" | "OUT" {
  if (qty <= 0) return "OUT";
  if (min > 0 && qty < min) return "LOW";
  return "OK";
}

export async function notifyStockChange(
  ctx: TenantContext,
  change: { productId: string; previousBalance: string; newBalance: string },
): Promise<void> {
  try {
    const product = await db.product.findFirst({
      where: { id: change.productId, businessId: ctx.businessId },
      select: { name: true, unit: true, minStock: true, balances: { select: { quantity: true } } },
    });
    if (!product) return;
    // Use the product-wide total (all locations) for alerting.
    const current = product.balances.reduce((s, b) => s + Number(b.quantity), 0);
    const delta = Number(change.newBalance) - Number(change.previousBalance);
    const previous = current - delta;
    const min = Number(product.minStock);
    const before = level(previous, min);
    const after = level(current, min);
    if (after === "OK" || before === after || (before === "OUT" && after === "LOW")) return;
    const event: LowStockEvent = {
      businessId: ctx.businessId,
      productId: change.productId,
      productName: product.name,
      unit: product.unit,
      previous,
      current,
      minStock: min,
      level: after,
    };
    await Promise.allSettled(channels.map((c) => c.sendLowStock(event)));
  } catch (e) {
    // Notifications must never break a stock operation.
    logError("notify.stock", e);
  }
}
