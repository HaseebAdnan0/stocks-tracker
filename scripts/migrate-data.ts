/**
 * Data migration script for PSX Tracker
 *
 * Migrates data from Django's db.sqlite3 to Next.js's SQLite database.
 * Run with: npm run migrate
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DJANGO_DB_PATH = path.join(process.cwd(), '..', 'db.sqlite3');
const NEXTJS_DB_PATH = path.join(process.cwd(), 'data', 'db.sqlite3');

function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory');
  }
}

function migrateHoldings(sourceDb: Database.Database, targetDb: Database.Database) {
  console.log('\nMigrating holdings...');

  // Check if source table exists
  const tableExists = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='core_holding'")
    .get();

  if (!tableExists) {
    console.log('  No holdings table found in source database');
    return 0;
  }

  // Get holdings from Django database
  const holdings = sourceDb.prepare('SELECT * FROM core_holding').all() as {
    id: number;
    symbol: string;
    quantity: number;
    buy_price: number;
    buy_date: string;
    broker: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }[];

  console.log(`  Found ${holdings.length} holdings to migrate`);

  // Insert into target database
  const insertStmt = targetDb.prepare(`
    INSERT INTO holdings (id, symbol, quantity, buy_price, buy_date, broker, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = targetDb.transaction((items: typeof holdings) => {
    for (const holding of items) {
      insertStmt.run(
        holding.id,
        holding.symbol,
        holding.quantity,
        holding.buy_price,
        holding.buy_date,
        holding.broker,
        holding.notes,
        holding.created_at,
        holding.updated_at
      );
    }
  });

  insertMany(holdings);
  console.log(`  Migrated ${holdings.length} holdings`);

  return holdings.length;
}

function migrateMarketDataCache(sourceDb: Database.Database, targetDb: Database.Database) {
  console.log('\nMigrating market data cache...');

  const tableExists = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='core_marketdatacache'")
    .get();

  if (!tableExists) {
    console.log('  No market data cache table found in source database');
    return 0;
  }

  const cacheEntries = sourceDb.prepare('SELECT * FROM core_marketdatacache').all() as {
    id: number;
    cache_key: string;
    data: string;
    fetched_at: string;
  }[];

  console.log(`  Found ${cacheEntries.length} cache entries to migrate`);

  const insertStmt = targetDb.prepare(`
    INSERT INTO market_data_cache (cache_key, data, fetched_at)
    VALUES (?, ?, ?)
  `);

  const insertMany = targetDb.transaction((items: typeof cacheEntries) => {
    for (const entry of items) {
      insertStmt.run(entry.cache_key, entry.data, entry.fetched_at);
    }
  });

  insertMany(cacheEntries);
  console.log(`  Migrated ${cacheEntries.length} market data cache entries`);

  return cacheEntries.length;
}

function migrateEODDataCache(sourceDb: Database.Database, targetDb: Database.Database) {
  console.log('\nMigrating EOD data cache...');

  const tableExists = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='core_eoddatacache'")
    .get();

  if (!tableExists) {
    console.log('  No EOD data cache table found in source database');
    return 0;
  }

  const cacheEntries = sourceDb.prepare('SELECT * FROM core_eoddatacache').all() as {
    id: number;
    symbol: string;
    data: string;
    fetched_at: string;
  }[];

  console.log(`  Found ${cacheEntries.length} EOD cache entries to migrate`);

  const insertStmt = targetDb.prepare(`
    INSERT INTO eod_data_cache (symbol, data, fetched_at)
    VALUES (?, ?, ?)
  `);

  const insertMany = targetDb.transaction((items: typeof cacheEntries) => {
    for (const entry of items) {
      insertStmt.run(entry.symbol, entry.data, entry.fetched_at);
    }
  });

  insertMany(cacheEntries);
  console.log(`  Migrated ${cacheEntries.length} EOD cache entries`);

  return cacheEntries.length;
}

function migrateFundamentalsCache(sourceDb: Database.Database, targetDb: Database.Database) {
  console.log('\nMigrating fundamentals cache...');

  const tableExists = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='core_fundamentalscache'")
    .get();

  if (!tableExists) {
    console.log('  No fundamentals cache table found in source database');
    return 0;
  }

  const cacheEntries = sourceDb.prepare('SELECT * FROM core_fundamentalscache').all() as {
    id: number;
    symbol: string;
    data: string;
    fetched_at: string;
  }[];

  console.log(`  Found ${cacheEntries.length} fundamentals cache entries to migrate`);

  const insertStmt = targetDb.prepare(`
    INSERT INTO fundamentals_cache (symbol, data, fetched_at)
    VALUES (?, ?, ?)
  `);

  const insertMany = targetDb.transaction((items: typeof cacheEntries) => {
    for (const entry of items) {
      insertStmt.run(entry.symbol, entry.data, entry.fetched_at);
    }
  });

  insertMany(cacheEntries);
  console.log(`  Migrated ${cacheEntries.length} fundamentals cache entries`);

  return cacheEntries.length;
}

function initializeTargetSchema(targetDb: Database.Database) {
  console.log('\nInitializing target database schema...');

  // Create holdings table
  targetDb.exec(`
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

  // Create market data cache table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS market_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create EOD data cache table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS eod_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create fundamentals cache table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS fundamentals_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
    CREATE INDEX IF NOT EXISTS idx_market_data_cache_key ON market_data_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_eod_data_symbol ON eod_data_cache(symbol);
    CREATE INDEX IF NOT EXISTS idx_fundamentals_symbol ON fundamentals_cache(symbol);
  `);

  console.log('  Schema initialized');
}

async function main() {
  console.log('='.repeat(60));
  console.log('PSX Tracker Data Migration');
  console.log('='.repeat(60));

  // Check if Django database exists
  if (!fs.existsSync(DJANGO_DB_PATH)) {
    console.error(`\nError: Django database not found at ${DJANGO_DB_PATH}`);
    console.error('Make sure you run this script from the psx-tracker directory');
    process.exit(1);
  }

  console.log(`\nSource database: ${DJANGO_DB_PATH}`);
  console.log(`Target database: ${NEXTJS_DB_PATH}`);

  // Ensure data directory exists
  ensureDataDirectory();

  // Open databases
  const sourceDb = new Database(DJANGO_DB_PATH, { readonly: true });
  const targetDb = new Database(NEXTJS_DB_PATH);
  targetDb.pragma('journal_mode = WAL');

  try {
    // Initialize schema
    initializeTargetSchema(targetDb);

    // Migrate data
    const holdingsCount = migrateHoldings(sourceDb, targetDb);
    const marketDataCount = migrateMarketDataCache(sourceDb, targetDb);
    const eodCount = migrateEODDataCache(sourceDb, targetDb);
    const fundamentalsCount = migrateFundamentalsCache(sourceDb, targetDb);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`  Holdings migrated:        ${holdingsCount}`);
    console.log(`  Market data cache:        ${marketDataCount}`);
    console.log(`  EOD data cache:           ${eodCount}`);
    console.log(`  Fundamentals cache:       ${fundamentalsCount}`);
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    sourceDb.close();
    targetDb.close();
  }
}

main().catch(console.error);
