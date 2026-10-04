import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

function createClient() {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type Client = ReturnType<typeof createClient>;

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { __stockflowPrisma?: Client };

export const db: Client = globalForPrisma.__stockflowPrisma ?? createClient();

if (env().NODE_ENV !== "production") globalForPrisma.__stockflowPrisma = db;

/** Transaction client type, for services that must run inside a transaction. */
export type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];
export type DbOrTx = Client | Tx;
