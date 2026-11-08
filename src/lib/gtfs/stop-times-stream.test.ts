import { describe, it, expect, vi } from 'vitest';
import { importStopTimesStream } from './stop-times-stream';
import type { StopTime } from '../../repositories/stop-time.repository';

function createStream(
  chunks: string[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

describe('Stop times stream importer', () => {
  it('imports CSV records correctly', async () => {
    const csv = [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
      'TRIP_1,08:00:00,08:01:00,STOP_1,1,1',
      'TRIP_1,08:10:00,08:11:00,STOP_2,2,0',
    ].join('\n');

    const imported: StopTime[] = [];

    const result = await importStopTimesStream(
      createStream([csv]),
      async (batch) => {
        imported.push(...batch);
      }
    );

    expect(result.processed).toBe(2);
    expect(result.batches).toBe(1);
    expect(imported).toHaveLength(2);

    expect(imported[0]).toEqual({
      tripId: 'TRIP_1',
      stopId: 'STOP_1',
      arrivalTime: '08:00:00',
      departureTime: '08:01:00',
      stopSequence: 1,
      timepoint: true,
    });

    expect(imported[1].timepoint).toBe(false);
  });

  it('handles CSV data split across stream chunks', async () => {
    const imported: StopTime[] = [];

    const result = await importStopTimesStream(
      createStream([
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint\nTRIP_1,08:00:',
        '00,08:01:00,STOP_1,1,1\n',
      ]),
      async (batch) => {
        imported.push(...batch);
      }
    );

    expect(result.processed).toBe(1);
    expect(imported[0].arrivalTime).toBe('08:00:00');
  });

  it('handles empty arrival and departure times', async () => {
    const csv = [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
      'TRIP_1,,,STOP_1,1,1',
    ].join('\n');

    const imported: StopTime[] = [];

    await importStopTimesStream(
      createStream([csv]),
      async (batch) => {
        imported.push(...batch);
      }
    );

    expect(imported[0].arrivalTime).toBeNull();
    expect(imported[0].departureTime).toBeNull();
  });

  it('imports records in batches of 500', async () => {
    const rows = [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
      ...Array.from(
        { length: 1001 },
        (_, index) =>
          `TRIP_1,08:00:00,08:01:00,STOP_${index},${index + 1},1`
      ),
    ];

    const batchSizes: number[] = [];

    const result = await importStopTimesStream(
      createStream([rows.join('\n')]),
      async (batch) => {
        batchSizes.push(batch.length);
      }
    );

    expect(result.processed).toBe(1001);
    expect(result.batches).toBe(3);
    expect(batchSizes).toEqual([500, 500, 1]);
  });

  it('reports import progress', async () => {
    const csv = [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
      'TRIP_1,08:00:00,08:01:00,STOP_1,1,1',
    ].join('\n');

    const onProgress = vi.fn();

    await importStopTimesStream(
      createStream([csv]),
      async () => {},
      onProgress
    );

    expect(onProgress).toHaveBeenCalledWith({
      processed: 1,
      batches: 1,
    });
  });

  it('rejects when a batch import fails', async () => {
    const csv = [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
      'TRIP_1,08:00:00,08:01:00,STOP_1,1,1',
    ].join('\n');

    await expect(
      importStopTimesStream(
        createStream([csv]),
        async () => {
          throw new Error('Database write failed');
        }
      )
    ).rejects.toThrow('Database write failed');
  });

  it('rejects records with missing trip_id', async () => {
  const csv = [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
    ',08:00:00,08:01:00,STOP_1,1,1',
  ].join('\n');

  await expect(
    importStopTimesStream(
      createStream([csv]),
      async () => {}
    )
  ).rejects.toThrow('missing trip_id or stop_id');
});

it('rejects invalid stop_sequence values', async () => {
  const csv = [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
    'TRIP_1,08:00:00,08:01:00,STOP_1,invalid,1',
  ].join('\n');

  await expect(
    importStopTimesStream(
      createStream([csv]),
      async () => {}
    )
  ).rejects.toThrow('Invalid stop_sequence');
});

it('rejects invalid timepoint values', async () => {
  const csv = [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,timepoint',
    'TRIP_1,08:00:00,08:01:00,STOP_1,1,5',
  ].join('\n');

  await expect(
    importStopTimesStream(
      createStream([csv]),
      async () => {}
    )
  ).rejects.toThrow('Invalid timepoint value');
});
});