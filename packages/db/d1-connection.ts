// Cloudflare D1 Database Connection
// D1 is Cloudflare's free SQLite-based database

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first(): Promise<any>;
  run(): Promise<D1Result>;
  all(): Promise<D1Result>;
}

export interface D1Result {
  results?: any[];
  success: boolean;
  error?: string;
  meta: {
    served_by: string;
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Helper function to generate unique IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${prefix}_${timestamp}${random}`;
}

// Database connection for Cloudflare Workers
export function getD1Database(env: any): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding not found. Make sure DB is bound in wrangler.toml');
  }
  return env.DB;
}