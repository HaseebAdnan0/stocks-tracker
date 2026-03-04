/**
 * SQLite database module for PSX Shariah Portfolio Tracker.
 *
 * Uses better-sqlite3 for synchronous database operations.
 */

import Database from 'better-sqlite3';
import path from 'path';

// Types for database records
export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  holding_id: number | null;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
  created_at: string;
}

export interface Holding {
  id: number;
  user_id?: number | null;
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  broker: string;
  notes: string | null;
  status?: 'active' | 'sold';
  realized_pl?: number;
  total_sold_quantity?: number;
  total_sold_value?: number;
  created_at: string;
  updated_at: string;
}

export interface MarketDataCache {
  id: number;
  cache_key: string;
  data: string; // JSON string
  fetched_at: string;
}

export interface EODDataCache {
  id: number;
  symbol: string;
  data: string; // JSON string
  fetched_at: string;
}

export interface FundamentalsCache {
  id: number;
  symbol: string;
  data: string; // JSON string
  fetched_at: string;
}

export interface TrackedSymbol {
  id: number;
  symbol: string;
  name: string | null;
  added_at: string;
}

// Database path
const DB_PATH = path.join(process.cwd(), 'data', 'db.sqlite3');

// Create database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

// Initialize database schema
function initializeSchema() {
  const database = db!;

  // Create users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create transactions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      holding_id INTEGER,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE SET NULL
    )
  `);

  // Create holdings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      buy_price REAL NOT NULL,
      buy_date TEXT NOT NULL,
      broker TEXT DEFAULT 'HMFS',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add user_id column if it doesn't exist (migration support)
  const columnsCheck = database.prepare("PRAGMA table_info(holdings)").all() as Array<{ name: string }>;
  const hasUserId = columnsCheck.some(col => col.name === 'user_id');
  const hasStatus = columnsCheck.some(col => col.name === 'status');
  const hasRealizedPL = columnsCheck.some(col => col.name === 'realized_pl');
  const hasTotalSoldQty = columnsCheck.some(col => col.name === 'total_sold_quantity');
  const hasTotalSoldValue = columnsCheck.some(col => col.name === 'total_sold_value');

  if (!hasUserId) {
    database.exec(`
      ALTER TABLE holdings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  if (!hasStatus) {
    database.exec(`
      ALTER TABLE holdings ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold'))
    `);
  }

  if (!hasRealizedPL) {
    database.exec(`
      ALTER TABLE holdings ADD COLUMN realized_pl REAL DEFAULT 0
    `);
  }

  if (!hasTotalSoldQty) {
    database.exec(`
      ALTER TABLE holdings ADD COLUMN total_sold_quantity INTEGER DEFAULT 0
    `);
  }

  if (!hasTotalSoldValue) {
    database.exec(`
      ALTER TABLE holdings ADD COLUMN total_sold_value REAL DEFAULT 0
    `);
  }

  // Create market data cache table
  database.exec(`
    CREATE TABLE IF NOT EXISTS market_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create EOD data cache table
  database.exec(`
    CREATE TABLE IF NOT EXISTS eod_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create fundamentals cache table
  database.exec(`
    CREATE TABLE IF NOT EXISTS fundamentals_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create tracked symbols table
  database.exec(`
    CREATE TABLE IF NOT EXISTS tracked_symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
    CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
    CREATE INDEX IF NOT EXISTS idx_market_data_cache_key ON market_data_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_eod_data_symbol ON eod_data_cache(symbol);
    CREATE INDEX IF NOT EXISTS idx_fundamentals_symbol ON fundamentals_cache(symbol);
    CREATE INDEX IF NOT EXISTS idx_tracked_symbols ON tracked_symbols(symbol);
  `);

  // Seed default KMI-30 symbols if table is empty
  const countStmt = database.prepare('SELECT COUNT(*) as count FROM tracked_symbols');
  const count = (countStmt.get() as { count: number }).count;
  if (count === 0) {
    const defaultSymbols = [
      'LUCK', 'HUBC', 'MEBL', 'PSO', 'OGDC', 'PPL', 'MARI', 'SYS', 'ENGRO', 'FFC',
      'EFERT', 'BAHL', 'SAZEW', 'MTL', 'SEARL', 'CHCC', 'MLCF', 'PIOC', 'GWLC', 'COLG',
      'GADT', 'NESTLE', 'NETSOL', 'OCTOPUS', 'TOMCL', 'AVN', 'ISL', 'FHAM', 'ATRL', 'KOHC',
    ];
    const insertStmt = database.prepare('INSERT INTO tracked_symbols (symbol) VALUES (?)');
    for (const symbol of defaultSymbols) {
      insertStmt.run(symbol);
    }
  }
}

// Holdings CRUD operations
export function getAllHoldings(userId?: number): Holding[] {
  if (userId !== undefined) {
    const stmt = getDb().prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY symbol');
    return stmt.all(userId) as Holding[];
  }
  const stmt = getDb().prepare('SELECT * FROM holdings ORDER BY symbol');
  return stmt.all() as Holding[];
}

export function getHoldingById(id: number): Holding | undefined {
  const stmt = getDb().prepare('SELECT * FROM holdings WHERE id = ?');
  return stmt.get(id) as Holding | undefined;
}

export function createHolding(holding: Omit<Holding, 'id' | 'created_at' | 'updated_at'>): Holding {
  const stmt = getDb().prepare(`
    INSERT INTO holdings (user_id, symbol, quantity, buy_price, buy_date, broker, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    holding.user_id ?? null,
    holding.symbol,
    holding.quantity,
    holding.buy_price,
    holding.buy_date,
    holding.broker,
    holding.notes
  );
  return getHoldingById(result.lastInsertRowid as number)!;
}

export function updateHolding(
  id: number,
  updates: Partial<Omit<Holding, 'id' | 'created_at' | 'updated_at'>>
): Holding | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.symbol !== undefined) {
    fields.push('symbol = ?');
    values.push(updates.symbol);
  }
  if (updates.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.buy_price !== undefined) {
    fields.push('buy_price = ?');
    values.push(updates.buy_price);
  }
  if (updates.buy_date !== undefined) {
    fields.push('buy_date = ?');
    values.push(updates.buy_date);
  }
  if (updates.broker !== undefined) {
    fields.push('broker = ?');
    values.push(updates.broker);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.realized_pl !== undefined) {
    fields.push('realized_pl = ?');
    values.push(updates.realized_pl);
  }
  if (updates.total_sold_quantity !== undefined) {
    fields.push('total_sold_quantity = ?');
    values.push(updates.total_sold_quantity);
  }
  if (updates.total_sold_value !== undefined) {
    fields.push('total_sold_value = ?');
    values.push(updates.total_sold_value);
  }

  if (fields.length === 0) {
    return getHoldingById(id);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const stmt = getDb().prepare(`UPDATE holdings SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getHoldingById(id);
}

export function deleteHolding(id: number): boolean {
  const stmt = getDb().prepare('DELETE FROM holdings WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function verifyHoldingOwnership(holdingId: number, userId: number): boolean {
  const stmt = getDb().prepare('SELECT user_id FROM holdings WHERE id = ?');
  const holding = stmt.get(holdingId) as { user_id: number | null } | undefined;
  return holding !== undefined && holding.user_id === userId;
}

// Transaction operations
export function createTransaction(transaction: Omit<Transaction, 'id' | 'created_at'>): Transaction {
  const stmt = getDb().prepare(`
    INSERT INTO transactions (user_id, holding_id, symbol, type, quantity, price, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    transaction.user_id,
    transaction.holding_id,
    transaction.symbol,
    transaction.type,
    transaction.quantity,
    transaction.price,
    transaction.date
  );
  const getStmt = getDb().prepare('SELECT * FROM transactions WHERE id = ?');
  return getStmt.get(result.lastInsertRowid) as Transaction;
}

export function getTransactions(
  userId: number,
  filters?: { symbol?: string; type?: 'buy' | 'sell' }
): Transaction[] {
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (filters?.symbol) {
    query += ' AND symbol = ?';
    params.push(filters.symbol.toUpperCase());
  }

  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  const stmt = getDb().prepare(query);
  return stmt.all(...params) as Transaction[];
}

// User operations
export function createUser(username: string, password_hash: string): User {
  const stmt = getDb().prepare(`
    INSERT INTO users (username, password_hash)
    VALUES (?, ?)
  `);
  const result = stmt.run(username, password_hash);
  const getUserStmt = getDb().prepare('SELECT * FROM users WHERE id = ?');
  return getUserStmt.get(result.lastInsertRowid) as User;
}

export function getUserByUsername(username: string): User | undefined {
  const stmt = getDb().prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as User | undefined;
}

// Cache operations
export function getMarketDataCache(cacheKey: string): MarketDataCache | undefined {
  const stmt = getDb().prepare('SELECT * FROM market_data_cache WHERE cache_key = ?');
  return stmt.get(cacheKey) as MarketDataCache | undefined;
}

export function setMarketDataCache(cacheKey: string, data: unknown): void {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO market_data_cache (cache_key, data, fetched_at)
    VALUES (?, ?, datetime('now'))
  `);
  stmt.run(cacheKey, JSON.stringify(data));
}

export function getEODDataCache(symbol: string): EODDataCache | undefined {
  const stmt = getDb().prepare('SELECT * FROM eod_data_cache WHERE symbol = ?');
  return stmt.get(symbol.toUpperCase()) as EODDataCache | undefined;
}

export function setEODDataCache(symbol: string, data: unknown): void {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO eod_data_cache (symbol, data, fetched_at)
    VALUES (?, ?, datetime('now'))
  `);
  stmt.run(symbol.toUpperCase(), JSON.stringify(data));
}

export function getFundamentalsCache(symbol: string): FundamentalsCache | undefined {
  const stmt = getDb().prepare('SELECT * FROM fundamentals_cache WHERE symbol = ?');
  return stmt.get(symbol.toUpperCase()) as FundamentalsCache | undefined;
}

export function setFundamentalsCache(symbol: string, data: unknown): void {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO fundamentals_cache (symbol, data, fetched_at)
    VALUES (?, ?, datetime('now'))
  `);
  stmt.run(symbol.toUpperCase(), JSON.stringify(data));
}

// Cache management
export function clearAllCaches(): { market_watch: number; eod_data: number; fundamentals: number } {
  const marketWatchStmt = getDb().prepare('DELETE FROM market_data_cache');
  const eodStmt = getDb().prepare('DELETE FROM eod_data_cache');
  const fundamentalsStmt = getDb().prepare('DELETE FROM fundamentals_cache');

  const marketWatchResult = marketWatchStmt.run();
  const eodResult = eodStmt.run();
  const fundamentalsResult = fundamentalsStmt.run();

  return {
    market_watch: marketWatchResult.changes,
    eod_data: eodResult.changes,
    fundamentals: fundamentalsResult.changes,
  };
}

export function getCacheStatus() {
  const db = getDb();

  // Market watch cache
  const marketWatchStmt = db.prepare(
    "SELECT fetched_at FROM market_data_cache WHERE cache_key = 'market-watch'"
  );
  const marketWatch = marketWatchStmt.get() as { fetched_at: string } | undefined;

  // EOD cache count
  const eodCountStmt = db.prepare('SELECT COUNT(*) as count FROM eod_data_cache');
  const eodCount = (eodCountStmt.get() as { count: number }).count;

  const eodOldestStmt = db.prepare('SELECT MIN(fetched_at) as oldest FROM eod_data_cache');
  const eodOldest = (eodOldestStmt.get() as { oldest: string | null }).oldest;

  // Fundamentals cache count
  const fundamentalsCountStmt = db.prepare('SELECT COUNT(*) as count FROM fundamentals_cache');
  const fundamentalsCount = (fundamentalsCountStmt.get() as { count: number }).count;

  const fundamentalsOldestStmt = db.prepare('SELECT MIN(fetched_at) as oldest FROM fundamentals_cache');
  const fundamentalsOldest = (fundamentalsOldestStmt.get() as { oldest: string | null }).oldest;

  return {
    market_watch: {
      last_updated: marketWatch?.fetched_at || null,
      age_seconds: marketWatch
        ? Math.floor((Date.now() - new Date(marketWatch.fetched_at).getTime()) / 1000)
        : null,
    },
    eod_data: {
      total_cached_symbols: eodCount,
      oldest_cache: eodOldest,
    },
    fundamentals: {
      total_cached_symbols: fundamentalsCount,
      oldest_cache: fundamentalsOldest,
    },
  };
}

// Tracked symbols CRUD operations
export function getTrackedSymbols(): TrackedSymbol[] {
  const stmt = getDb().prepare('SELECT * FROM tracked_symbols ORDER BY symbol');
  return stmt.all() as TrackedSymbol[];
}

export function getTrackedSymbolsList(): string[] {
  const stmt = getDb().prepare('SELECT symbol FROM tracked_symbols ORDER BY symbol');
  return (stmt.all() as { symbol: string }[]).map((row) => row.symbol);
}

export function addTrackedSymbol(symbol: string, name?: string): TrackedSymbol | null {
  try {
    const stmt = getDb().prepare('INSERT INTO tracked_symbols (symbol, name) VALUES (?, ?)');
    const result = stmt.run(symbol.toUpperCase(), name || null);
    const getStmt = getDb().prepare('SELECT * FROM tracked_symbols WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as TrackedSymbol;
  } catch {
    // Symbol already exists
    return null;
  }
}

export function updateTrackedSymbolName(symbol: string, name: string): boolean {
  const stmt = getDb().prepare('UPDATE tracked_symbols SET name = ? WHERE symbol = ?');
  const result = stmt.run(name, symbol.toUpperCase());
  return result.changes > 0;
}

export function removeTrackedSymbol(symbol: string): boolean {
  const stmt = getDb().prepare('DELETE FROM tracked_symbols WHERE symbol = ?');
  const result = stmt.run(symbol.toUpperCase());
  return result.changes > 0;
}

export function isSymbolTracked(symbol: string): boolean {
  const stmt = getDb().prepare('SELECT 1 FROM tracked_symbols WHERE symbol = ?');
  return !!stmt.get(symbol.toUpperCase());
}
