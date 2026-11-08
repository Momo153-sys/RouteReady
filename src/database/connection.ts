import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { runMigrations } from './migrations';

const sqlite = new SQLiteConnection(CapacitorSQLite);
const DATABASE_NAME = 'routeready';
const DATABASE_VERSION = 1;

let db: SQLiteDBConnection | null = null;

export async function initializeDatabase(): Promise<SQLiteDBConnection> {
  if (db) return db;

  const consistency = await sqlite.checkConnectionsConsistency();
  const isConnection = (
    await sqlite.isConnection(DATABASE_NAME, false)
  ).result;

  if (consistency.result && isConnection) {
    db = await sqlite.retrieveConnection(DATABASE_NAME, false);
  } else {
    db = await sqlite.createConnection(
      DATABASE_NAME,
      false,
      'no-encryption',
      DATABASE_VERSION,
      false,
    );
  }

  await db.open();
  await runMigrations(db);

  return db;
}

export function getDatabase(): SQLiteDBConnection {
  if (!db) {
    throw new Error('Database has not been initialized.');
  }

  return db;
}

export async function verifyDatabase(): Promise<string[]> {
  const database = getDatabase();

  const result = await database.query(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name;
  `);

  return (result.values ?? []).map(table => String(table.name));
}

export async function getStopCount(): Promise<number> {
  const database = getDatabase();

  const result = await database.query(
    'SELECT COUNT(*) AS count FROM stops'
  );

  return Number(result.values?.[0]?.count ?? 0);
}