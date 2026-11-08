import initSqlJs, { type Database } from 'sql.js';

const DATABASE_URL = '/maps/istanbul-offline.mbtiles';
const WASM_URL = '/wasm/sql-wasm.wasm';

let database: Database | null = null;
let initializationPromise: Promise<void> | null = null;

export interface OfflineTile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

export async function decompressTile(
  compressedData: Uint8Array,
): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(compressedData.byteLength);
  new Uint8Array(buffer).set(compressedData);

  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));

  const decompressed = await new Response(stream).arrayBuffer();

  return new Uint8Array(decompressed);
}

export async function openOfflineMap(): Promise<void> {
  if (database) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => WASM_URL,
    });

    const response = await fetch(DATABASE_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to load offline map: HTTP ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();

    database = new SQL.Database(new Uint8Array(buffer));

    const result = database.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    const tables = result[0]?.values.flat() ?? [];

    if (!tables.includes('tiles') || !tables.includes('metadata')) {
      database.close();
      database = null;
      throw new Error('Invalid MBTiles database structure.');
    }
  })();

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export async function getOfflineTile(
  z: number,
  x: number,
  y: number,
): Promise<OfflineTile | null> {
  if (!database) {
    throw new Error('Offline map database is not open.');
  }

  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z
  ) {
    throw new Error('Invalid tile coordinates.');
  }

  const tileRow = 2 ** z - 1 - y;

  const statement = database.prepare(`
    SELECT tile_data
    FROM tiles
    WHERE zoom_level = ?
      AND tile_column = ?
      AND tile_row = ?
  `);

  try {
    statement.bind([z, x, tileRow]);

    if (!statement.step()) {
      return null;
    }

    const row = statement.getAsObject();
    const tileData = row.tile_data;

    if (!(tileData instanceof Uint8Array)) {
      throw new Error('Invalid MBTiles tile data format.');
    }

    const data = await decompressTile(tileData);

    return { z, x, y, data };
  } finally {
    statement.free();
  }
}

export async function closeOfflineMap(): Promise<void> {
  if (!database) return;

  database.close();
  database = null;
  initializationPromise = null;
}

export async function getOfflineMapMetadata(): Promise<
  Record<string, string>
> {
  if (!database) {
    throw new Error('Offline map database is not open.');
  }

  const result = database.exec(
    'SELECT name, value FROM metadata',
  );

  const metadata: Record<string, string> = {};

  for (const row of result[0]?.values ?? []) {
    metadata[String(row[0])] = String(row[1]);
  }

  return metadata;
}