export async function diagnoseStopTimesSource() {
  const response = await fetch('data/stop_times.txt');

  if (!response.ok || !response.body) {
    throw new Error('Could not read stop_times.txt');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let isFirstChunk = true;
  let headers: string[] = [];

  let totalRecords = 0;
  let duplicateKeys = 0;

  const keys = new Set<string>();
  const tripCounts = new Map<string, number>();

  function processLine(line: string) {
    if (!line.trim()) return;

    const values = line.split(',');

    if (!headers.length) {
      headers = values.map(value => value.trim());
      return;
    }

    const record = Object.fromEntries(
      headers.map((header, index) => [
        header,
        (values[index] ?? '').trim(),
      ])
    );

    const tripId = record.trip_id;
    const sequence = record.stop_sequence;

    if (!tripId || !sequence) return;

    totalRecords++;

    const key = `${tripId}:${sequence}`;

    if (keys.has(key)) {
      duplicateKeys++;
    } else {
      keys.add(key);
    }

    tripCounts.set(
      tripId,
      (tripCounts.get(tripId) ?? 0) + 1
    );
  }

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
      processLine(line);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    processLine(buffer);
  }

  const report = {
    totalRecords,
    uniqueKeys: keys.size,
    duplicateKeys,
    uniqueTrips: tripCounts.size,
    tripsWithAtLeastTwoStops: [...tripCounts.values()]
      .filter(count => count >= 2).length,
  };

  console.log('Source stop-times diagnostic:', report);

  return report;
}