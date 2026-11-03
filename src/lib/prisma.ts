import { PrismaClient } from "@/generated/prisma/client";
import { createDbAdapter } from "./db-adapter";

// Prisma 7 requires a driver adapter at runtime (the URL is no longer read
// from the schema). We use the node-postgres adapter.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createDbAdapter(),
  });

// Reuse a single client across hot reloads in dev to avoid exhausting
// database connections.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
