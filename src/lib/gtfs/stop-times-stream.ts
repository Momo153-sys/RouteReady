import Papa from 'papaparse';
import type { StopTime } from '../../repositories/stop-time.repository';
import { isValidGtfsTime } from './validation';

const BATCH_SIZE = 500;

export interface StopTimesImportProgress {
  processed: number;
  batches: number;
}

export async function importStopTimesStream(
  stream: ReadableStream<Uint8Array>,
  onBatch: (batch: StopTime[]) => Promise<void>,
  onProgress?: (progress: StopTimesImportProgress) => void
): Promise<StopTimesImportProgress> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let headers: string[] = [];
  let batch: StopTime[] = [];
  let processed = 0;
  let batches = 0;
  let isFirstChunk = true;

  const processLine = async (line: string): Promise<void> => {
    if (!line.trim()) return;

    const parsed = Papa.parse<string[]>(line, {
      delimiter: ',',
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }

    const values = parsed.data[0];

    if (!headers.length) {
      headers = values.map((header) => header.trim());
      return;
    }

    const record = Object.fromEntries(
      headers.map((header, index) => [
        header,
        (values[index] ?? '').trim(),
      ])
    );

    const stopSequence = Number(record.stop_sequence);

if (!record.trip_id || !record.stop_id) {
  throw new Error('Stop time record is missing trip_id or stop_id.');
}

if (
  !Number.isInteger(stopSequence) ||
  stopSequence < 0
) {
  throw new Error(
    `Invalid stop_sequence: ${record.stop_sequence}`
  );
}

if (
  record.timepoint !== '' &&
  record.timepoint !== '0' &&
  record.timepoint !== '1'
) {
  throw new Error(
    `Invalid timepoint value: ${record.timepoint}`
  );
}

if (
  (record.arrival_time && !isValidGtfsTime(record.arrival_time)) ||
  (record.departure_time && !isValidGtfsTime(record.departure_time))
) {
  throw new Error(
    `Invalid GTFS time: arrival=${record.arrival_time}, departure=${record.departure_time}`
  );
}

const stopTime: StopTime = {
  tripId: record.trip_id,
  stopId: record.stop_id,
  arrivalTime: record.arrival_time || null,
  departureTime: record.departure_time || null,
  stopSequence,
  timepoint: record.timepoint === ''
    ? true
    : record.timepoint === '1',
};

    batch.push(stopTime);
    processed++;

    if (batch.length >= BATCH_SIZE) {
      await onBatch(batch);
      batches++;
      batch = [];

      onProgress?.({ processed, batches });
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      let chunk = decoder.decode(value, { stream: true });

      if (isFirstChunk) {
        chunk = chunk.replace(/^\uFEFF/, '');
        isFirstChunk = false;
      }

      buffer += chunk;

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        await processLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      await processLine(buffer);
    }

    if (batch.length > 0) {
      await onBatch(batch);
      batches++;
    }

    onProgress?.({ processed, batches });

    return { processed, batches };
  } catch (error) {
    await reader.cancel(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}