
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openOfflineMap,
  getOfflineMapMetadata,
  getOfflineTile,
  closeOfflineMap,
  decompressTile,
} from './mbtiles';

const { mockDatabase, mockStatement, mockExec, mockClose } =
  vi.hoisted(() => ({
    mockDatabase: vi.fn(),
    mockStatement: {
      bind: vi.fn(),
      step: vi.fn(),
      getAsObject: vi.fn(),
      free: vi.fn(),
    },
    mockExec: vi.fn(),
    mockClose: vi.fn(),
  }));

vi.mock('sql.js/dist/sql-wasm.js', () => ({
  default: vi.fn().mockResolvedValue({
    Database: mockDatabase,
  }),
}));

describe('MBTiles reader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      }),
    );

    mockDatabase.mockImplementation(function () {
      return {
        exec: mockExec,
        prepare: vi.fn().mockReturnValue(mockStatement),
        close: mockClose,
      };
    });

    mockExec.mockImplementation((query: string) => {
      if (query.includes('sqlite_master')) {
        return [
          {
            values: [['tiles'], ['metadata']],
          },
        ];
      }

      if (query.includes('metadata')) {
        return [
          {
            values: [
              ['name', 'Istanbul Offline Map'],
              ['format', 'pbf'],
              ['minzoom', '10'],
              ['maxzoom', '14'],
            ],
          },
        ];
      }

      return [];
    });

    mockStatement.bind.mockReset();
    mockStatement.step.mockReturnValue(false);
    mockStatement.getAsObject.mockReturnValue({});
    mockStatement.free.mockReset();
  });

  it('reads metadata from the MBTiles database', async () => {
    await openOfflineMap();

    const metadata = await getOfflineMapMetadata();

    expect(metadata).toEqual({
      name: 'Istanbul Offline Map',
      format: 'pbf',
      minzoom: '10',
      maxzoom: '14',
    });
  });

  it('returns null when a tile does not exist', async () => {
    await openOfflineMap();

    const tile = await getOfflineTile(10, 300, 400);

    expect(tile).toBeNull();
    expect(mockStatement.free).toHaveBeenCalled();
  });

  it('closes the database connection', async () => {
    await openOfflineMap();

    await closeOfflineMap();

    expect(mockClose).toHaveBeenCalledTimes(1);

    await expect(getOfflineMapMetadata()).rejects.toThrow(
      'Offline map database is not open.',
    );
  });

  it('converts XYZ Y coordinates to TMS when querying tiles', async () => {
    await openOfflineMap();

    await getOfflineTile(10, 300, 400);

    expect(mockStatement.bind).toHaveBeenCalledWith([
      10,
      300,
      623,
    ]);
  });

  it('rejects invalid tile coordinates', async () => {
    await openOfflineMap();

    await expect(getOfflineTile(10, -1, 400)).rejects.toThrow(
      'Invalid tile coordinates.',
    );
  });

  it('decompresses Gzip-compressed tile data', async () => {
    const originalText = 'RouteReady offline tile test';

    const compressedStream = new Blob([originalText])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));

    const compressedBuffer = await new Response(
      compressedStream,
    ).arrayBuffer();

    const compressedData = new Uint8Array(compressedBuffer);

    const decompressed = await decompressTile(compressedData);

    expect(new TextDecoder().decode(decompressed)).toBe(originalText);
  });
});
