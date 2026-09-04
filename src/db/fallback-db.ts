import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type DbStore = Record<string, any[]>;

function getTableName(table: any): string {
  if (!table) return "unknown";
  if (typeof table === "string") return table;
  return (
    table[Symbol.for("drizzle:Name")] ||
    table[Symbol.for("drizzle:PgTableName")] ||
    table._?.name ||
    table.name ||
    "default"
  );
}

function getColumnKey(col: any): string {
  if (!col) return "";
  if (typeof col === "string") return col;
  return col.key || col.name || col._?.name || String(col);
}

function loadStore(): DbStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load fallback db:", err);
  }
  return {};
}

function saveStore(store: DbStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save fallback db:", err);
  }
}

function getColumnName(chunk: any): string | null {
  if (!chunk || typeof chunk !== "object") return null;
  return chunk.name || chunk.config?.name || chunk.key || null;
}

function getParamValue(chunk: any): any {
  if (chunk === null || chunk === undefined) return chunk;
  if (typeof chunk === "object" && "value" in chunk && !Array.isArray(chunk.value)) return chunk.value;
  return chunk;
}

function matchesCondition(row: any, condition: any): boolean {
  if (!condition) return true;

  // Drizzle BinaryOp / Eq condition
  if (condition.left !== undefined && condition.right !== undefined) {
    const colName = getColumnName(condition.left) || getColumnKey(condition.left);
    const targetVal = getParamValue(condition.right);
    const rowVal = row[colName] !== undefined ? row[colName] : (row[toSnakeCase(colName)] ?? row[toCamelCase(colName)]);
    return rowVal === targetVal;
  }

  // Drizzle SQL object / queryChunks
  if (Array.isArray(condition.queryChunks)) {
    const chunks = condition.queryChunks;

    // Check if compound (and / or) with nested SQL objects
    const sqlChunks = chunks.filter((c: any) => c && typeof c === "object" && Array.isArray(c.queryChunks));
    if (sqlChunks.length > 0) {
      // Is it a wrapper with single nested SQL? e.g. ( SQL )
      if (chunks.length === 3 && chunks[0]?.value?.[0] === "(" && chunks[2]?.value?.[0] === ")") {
        return matchesCondition(row, chunks[1]);
      }

      // Check if OR condition
      const isOr = chunks.some(
        (c: any) => Array.isArray(c?.value) && c.value.some((v: any) => typeof v === "string" && v.toLowerCase().includes(" or "))
      );

      if (isOr) {
        return sqlChunks.some((sub: any) => matchesCondition(row, sub));
      } else {
        return sqlChunks.every((sub: any) => matchesCondition(row, sub));
      }
    }

    // Simple expression: Column + Op + Value
    let colName: string | null = null;
    let op = "=";
    let targetVal: any = undefined;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const name = getColumnName(c);
      if (name && !colName) {
        colName = name;
        continue;
      }
      if (c && Array.isArray(c.value) && typeof c.value[0] === "string") {
        const s = c.value[0].trim().toLowerCase();
        if (["=", "!=", "<>", ">", "<", ">=", "<=", "is", "is not"].includes(s)) {
          op = s;
        }
      }
      if (c && typeof c === "object" && "value" in c && !Array.isArray(c.value)) {
        targetVal = c.value;
      }
    }

    if (colName) {
      const rowVal = row[colName] !== undefined ? row[colName] : (row[toSnakeCase(colName)] ?? row[toCamelCase(colName)]);
      if (op === "=" || op === "is") return rowVal === targetVal;
      if (op === "!=" || op === "<>" || op === "is not") return rowVal !== targetVal;
      if (op === ">") return rowVal > targetVal;
      if (op === "<") return rowVal < targetVal;
      if (op === ">=") return rowVal >= targetVal;
      if (op === "<=") return rowVal <= targetVal;
    }
  }

  return true;
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeRow(row: any): any {
  const result: any = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const camel = toCamelCase(k);
    if (!(camel in result)) {
      result[camel] = v;
    }
    if ((camel === "createdAt" || camel === "updatedAt" || camel === "startedAt" || camel === "finishedAt") && v && !(v instanceof Date)) {
      result[camel] = new Date(v as any);
    }
  }
  return result;
}

export function createFallbackDb() {
  return {
    select(..._fields: any[]) {
      let currentTable = "";
      let whereCond: any = null;
      let limitCount: number | null = null;
      let orderCol: any = null;
      let orderDesc = false;

      const queryBuilder = {
        from(table: any) {
          currentTable = getTableName(table);
          return queryBuilder;
        },
        where(cond: any) {
          whereCond = cond;
          return queryBuilder;
        },
        orderBy(...orders: any[]) {
          if (orders.length > 0) {
            const first = orders[0];
            if (first?._?.type === "desc" || first?.direction === "desc" || first?.config?.direction === "desc") {
              orderDesc = true;
              orderCol = getColumnKey(first.column || first.config?.column || first);
            } else {
              orderCol = getColumnKey(first);
            }
          }
          return queryBuilder;
        },
        limit(n: number) {
          limitCount = n;
          return queryBuilder;
        },
        then<TResult1 = any, TResult2 = never>(
          onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null | undefined,
          onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
        ): Promise<TResult1 | TResult2> {
          try {
            const store = loadStore();
            let rows = (store[currentTable] || []).map(normalizeRow);

            if (whereCond) {
              rows = rows.filter((r) => matchesCondition(r, whereCond));
            }

            if (orderCol) {
              const camel = toCamelCase(orderCol);
              rows.sort((a, b) => {
                const va = a[camel] ?? a[orderCol];
                const vb = b[camel] ?? b[orderCol];
                const timeA = va instanceof Date ? va.getTime() : va;
                const timeB = vb instanceof Date ? vb.getTime() : vb;
                if (timeA < timeB) return orderDesc ? 1 : -1;
                if (timeA > timeB) return orderDesc ? -1 : 1;
                return 0;
              });
            }

            if (typeof limitCount === "number") {
              rows = rows.slice(0, limitCount);
            }

            return Promise.resolve(rows as any).then(onFulfilled as any, onRejected as any);
          } catch (err) {
            if (onRejected) return (onRejected as any)(err);
            return Promise.reject(err);
          }
        },
      };

      return queryBuilder;
    },

    insert(table: any) {
      const tableName = getTableName(table);
      let insertedValues: any[] = [];

      const queryBuilder = {
        values(values: any | any[]) {
          insertedValues = Array.isArray(values) ? values : [values];
          return queryBuilder;
        },
        onConflictDoNothing() {
          return queryBuilder;
        },
        onConflictDoUpdate() {
          return queryBuilder;
        },
        returning() {
          return queryBuilder;
        },
        then<TResult1 = any, TResult2 = never>(
          onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null | undefined,
          onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
        ): Promise<TResult1 | TResult2> {
          try {
            const store = loadStore();
            if (!store[tableName]) store[tableName] = [];

            const created: any[] = [];
            for (const val of insertedValues) {
              const record = {
                ...val,
                createdAt: val.createdAt ?? new Date(),
                updatedAt: val.updatedAt ?? new Date(),
              };

              // Handle primary key deduplication
              const pk = record.id || record.sha256 || record.key;
              if (pk) {
                const idx = store[tableName].findIndex(
                  (r) => (r.id && r.id === pk) || (r.sha256 && r.sha256 === pk) || (r.key && r.key === pk)
                );
                if (idx >= 0) {
                  store[tableName][idx] = { ...store[tableName][idx], ...record };
                  created.push(normalizeRow(store[tableName][idx]));
                  continue;
                }
              }

              store[tableName].push(record);
              created.push(normalizeRow(record));
            }

            saveStore(store);
            return Promise.resolve(created as any).then(onFulfilled as any, onRejected as any);
          } catch (err) {
            if (onRejected) return (onRejected as any)(err);
            return Promise.reject(err);
          }
        },
      };

      return queryBuilder;
    },

    update(table: any) {
      const tableName = getTableName(table);
      let updateValues: any = {};
      let whereCond: any = null;

      const queryBuilder = {
        set(values: any) {
          updateValues = values;
          return queryBuilder;
        },
        where(cond: any) {
          whereCond = cond;
          return queryBuilder;
        },
        returning() {
          return queryBuilder;
        },
        then<TResult1 = any, TResult2 = never>(
          onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null | undefined,
          onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
        ): Promise<TResult1 | TResult2> {
          try {
            const store = loadStore();
            const list = store[tableName] || [];
            const updated: any[] = [];

            for (let i = 0; i < list.length; i++) {
              if (matchesCondition(list[i], whereCond)) {
                list[i] = {
                  ...list[i],
                  ...updateValues,
                  updatedAt: updateValues.updatedAt ?? new Date(),
                };
                updated.push(normalizeRow(list[i]));
              }
            }

            store[tableName] = list;
            saveStore(store);
            return Promise.resolve(updated as any).then(onFulfilled as any, onRejected as any);
          } catch (err) {
            if (onRejected) return (onRejected as any)(err);
            return Promise.reject(err);
          }
        },
      };

      return queryBuilder;
    },

    delete(table: any) {
      const tableName = getTableName(table);
      let whereCond: any = null;

      const queryBuilder = {
        where(cond: any) {
          whereCond = cond;
          return queryBuilder;
        },
        returning() {
          return queryBuilder;
        },
        then<TResult1 = any, TResult2 = never>(
          onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null | undefined,
          onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
        ): Promise<TResult1 | TResult2> {
          try {
            const store = loadStore();
            const list = store[tableName] || [];
            const deleted: any[] = [];
            const remaining: any[] = [];

            for (const item of list) {
              if (matchesCondition(item, whereCond)) {
                deleted.push(normalizeRow(item));
              } else {
                remaining.push(item);
              }
            }

            store[tableName] = remaining;
            saveStore(store);
            return Promise.resolve(deleted as any).then(onFulfilled as any, onRejected as any);
          } catch (err) {
            if (onRejected) return (onRejected as any)(err);
            return Promise.reject(err);
          }
        },
      };

      return queryBuilder;
    },

    execute(_sql: any) {
      return Promise.resolve([]);
    },
  };
}
