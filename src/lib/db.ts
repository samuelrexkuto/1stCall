import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // Reuse a single pool during local development to avoid creating excess connections.
  // eslint-disable-next-line no-var
  var __workforceDispatchPool: Pool | undefined;
}

function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.PGHOST ?? "localhost";
  const port = process.env.PGPORT ?? "5432";
  const database = process.env.PGDATABASE ?? "workforce_dispatch";
  const user = process.env.PGUSER ?? "user";
  const password = process.env.PGPASSWORD ?? "";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function createPool() {
  return new Pool({
    connectionString: getConnectionString(),
  });
}

export const db = global.__workforceDispatchPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__workforceDispatchPool = db;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}
