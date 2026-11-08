
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { INITIAL_SCHEMA } from './schema';

export async function runMigrations(
  db: SQLiteDBConnection
): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON;');

  const result = await db.query('PRAGMA user_version;');

  const currentVersion = Number(result.values?.[0]?.user_version ?? 0);

  if (currentVersion < 1) {
    await db.execute(INITIAL_SCHEMA);

    await db.execute('PRAGMA user_version = 1;');
  }
}
