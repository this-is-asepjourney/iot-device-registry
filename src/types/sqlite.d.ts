declare module 'node:sqlite' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...params: (string | number | boolean | null | undefined)[]): Record<string, unknown>[];
    get(...params: (string | number | boolean | null | undefined)[]): Record<string, unknown> | undefined;
    run(...params: (string | number | boolean | null | undefined)[]): RunResult;
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; enableForeignKeyConstraints?: boolean });
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
