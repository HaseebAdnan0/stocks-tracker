/**
 * Transaction migration script for PSX Tracker
 *
 * Creates transaction records for existing holdings that don't have them.
 * Run with: npx tsx scripts/migrate-to-transactions.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.sqlite3');

interface Holding {
  id: number;
  user_id: number | null;
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  created_at: string;
}

interface Transaction {
  id: number;
  holding_id: number | null;
}

function migrateHoldingsToTransactions(db: Database.Database) {
  console.log('\nMigrating existing holdings to transaction records...');

  // Get all holdings that have a user_id
  const holdings = db
    .prepare('SELECT id, user_id, symbol, quantity, buy_price, buy_date, created_at FROM holdings WHERE user_id IS NOT NULL')
    .all() as Holding[];

  console.log(`  Found ${holdings.length} holdings to process`);

  let createdCount = 0;
  let skippedCount = 0;

  // Check each holding for existing 'buy' transaction
  const checkStmt = db.prepare(
    "SELECT id FROM transactions WHERE holding_id = ? AND type = 'buy'"
  );
  const insertStmt = db.prepare(`
    INSERT INTO transactions (user_id, holding_id, symbol, type, quantity, price, date)
    VALUES (?, ?, ?, 'buy', ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const holding of holdings) {
      // Check if transaction already exists
      const existingTransaction = checkStmt.get(holding.id) as Transaction | undefined;

      if (existingTransaction) {
        skippedCount++;
        continue;
      }

      // Create buy transaction for this holding
      insertStmt.run(
        holding.user_id,
        holding.id,
        holding.symbol,
        holding.quantity,
        holding.buy_price,
        holding.buy_date
      );
      createdCount++;
    }
  });

  transaction();

  console.log(`  Created ${createdCount} transaction records`);
  console.log(`  Skipped ${skippedCount} holdings (already have transactions)`);

  return { created: createdCount, skipped: skippedCount };
}

async function main() {
  console.log('='.repeat(60));
  console.log('PSX Tracker Transaction Migration');
  console.log('='.repeat(60));

  console.log(`\nDatabase: ${DB_PATH}`);

  // Open database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    const result = migrateHoldingsToTransactions(db);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`  Transactions created:     ${result.created}`);
    console.log(`  Holdings skipped:         ${result.skipped}`);
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch(console.error);
