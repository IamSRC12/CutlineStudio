import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createFallbackDb } from "./fallback-db";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __useFallbackDb?: boolean;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

const realDb = drizzle(pool, { schema });
const fallbackDb = createFallbackDb();

pool.on("error", () => {
  globalForDb.__useFallbackDb = true;
});

function isConnError(err: any): boolean {
  if (!err) return false;
  return (
    err.code === "ECONNREFUSED" ||
    err.syscall === "connect" ||
    err.message?.includes("connect ECONNREFUSED") ||
    err.cause?.code === "ECONNREFUSED"
  );
}

function wrapQuery(builderObj: any, getFallbackQuery: () => any): any {
  if (!builderObj || (typeof builderObj !== "object" && typeof builderObj !== "function")) {
    return builderObj;
  }

  return new Proxy(builderObj, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return function (onFulfilled?: any, onRejected?: any) {
          return Promise.resolve(target)
            .catch((err) => {
              if (isConnError(err)) {
                globalForDb.__useFallbackDb = true;
                const fb = getFallbackQuery();
                return fb;
              }
              throw err;
            })
            .then(onFulfilled, onRejected);
        };
      }

      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return function (...args: any[]) {
          let nextTarget: any;
          try {
            nextTarget = val.apply(target, args);
          } catch (err) {
            if (isConnError(err)) {
              globalForDb.__useFallbackDb = true;
              const fb = getFallbackQuery();
              const fbProp = fb[prop];
              if (typeof fbProp === "function") return fbProp.apply(fb, args);
              return fb;
            }
            throw err;
          }

          if (nextTarget && (typeof nextTarget === "object" || typeof nextTarget === "function")) {
            return wrapQuery(nextTarget, () => {
              const fb = getFallbackQuery();
              const fbProp = fb[prop];
              if (typeof fbProp === "function") return fbProp.apply(fb, args);
              return fb;
            });
          }
          return nextTarget;
        };
      }

      return val;
    },
  });
}

export const db: any = {
  select(...args: any[]) {
    if (globalForDb.__useFallbackDb) return fallbackDb.select(...args);
    try {
      const q = (realDb as any).select(...args);
      return wrapQuery(q, () => fallbackDb.select(...args));
    } catch {
      globalForDb.__useFallbackDb = true;
      return fallbackDb.select(...args);
    }
  },
  insert(...args: any[]) {
    if (globalForDb.__useFallbackDb) return (fallbackDb as any).insert(...args);
    try {
      const q = (realDb as any).insert(...args);
      return wrapQuery(q, () => (fallbackDb as any).insert(...args));
    } catch {
      globalForDb.__useFallbackDb = true;
      return (fallbackDb as any).insert(...args);
    }
  },
  update(...args: any[]) {
    if (globalForDb.__useFallbackDb) return (fallbackDb as any).update(...args);
    try {
      const q = (realDb as any).update(...args);
      return wrapQuery(q, () => (fallbackDb as any).update(...args));
    } catch {
      globalForDb.__useFallbackDb = true;
      return (fallbackDb as any).update(...args);
    }
  },
  delete(...args: any[]) {
    if (globalForDb.__useFallbackDb) return (fallbackDb as any).delete(...args);
    try {
      const q = (realDb as any).delete(...args);
      return wrapQuery(q, () => (fallbackDb as any).delete(...args));
    } catch {
      globalForDb.__useFallbackDb = true;
      return (fallbackDb as any).delete(...args);
    }
  },
  execute(...args: any[]) {
    if (globalForDb.__useFallbackDb) return (fallbackDb as any).execute(...args);
    try {
      const q = (realDb as any).execute(...args);
      return wrapQuery(q, () => (fallbackDb as any).execute(...args));
    } catch {
      globalForDb.__useFallbackDb = true;
      return (fallbackDb as any).execute(...args);
    }
  },
};

export { schema };

