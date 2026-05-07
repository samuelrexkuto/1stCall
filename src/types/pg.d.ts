declare module "pg" {
  export interface QueryResultRow {}

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[];
    rowCount: number | null;
  }

  export class Pool {
    constructor(config?: { connectionString?: string });
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
  }
}
