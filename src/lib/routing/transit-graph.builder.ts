import { getDatabase } from '../../database/dexie';
import type { TransitEdge } from '../../domain/transit-edge';

const BATCH_SIZE = 10_000;

export interface GraphBuildResult {
  processedStopTimes: number;
  generatedEdges: number;
  storedConnections: number;
}

export async function buildTransitGraph(
  onProgress?: (processed: number, total: number) => void
): Promise<GraphBuildResult> {
  const db = getDatabase();
  const totalStopTimes = await db.stopTimes.count();

  const [trips, routes] = await Promise.all([
    db.trips.toArray(),
    db.routes.toArray(),
  ]);

  const tripRouteMap = new Map(
    trips.map(trip => [trip.id, trip.routeId])
  );

  const routeNameMap = new Map(
    routes.map(route => [
      route.id,
      route.shortName || route.longName || route.id,
    ])
  );

  await db.connections.clear();

  let processedStopTimes = 0;
  let generatedEdges = 0;

  let lastKey: [string, number] | undefined;
  let previousStopTime:
    | {
        tripId: string;
        stopId: string;
      }
    | undefined;

  while (true) {
    const rawRecords = await (
      lastKey
        ? db.stopTimes
            .where('[tripId+stopSequence]')
            .aboveOrEqual(lastKey)
            .limit(BATCH_SIZE + 1)
        : db.stopTimes
            .orderBy('[tripId+stopSequence]')
            .limit(BATCH_SIZE)
    ).toArray();

    if (rawRecords.length === 0) break;

    const records = lastKey ? rawRecords.slice(1) : rawRecords;
    if (records.length === 0) break;

    const edges: TransitEdge[] = [];

    for (const record of records) {
      if (
        previousStopTime &&
        previousStopTime.tripId === record.tripId &&
        previousStopTime.stopId !== record.stopId
      ) {
        const routeId = tripRouteMap.get(record.tripId);
        const routeName = routeId
          ? routeNameMap.get(routeId)
          : undefined;

        if (routeId && routeName) {
          edges.push({
            routeId,
            routeName,
            fromStopId: previousStopTime.stopId,
            toStopId: record.stopId,
          });
        }
      }

      previousStopTime = {
        tripId: record.tripId,
        stopId: record.stopId,
      };
    }

    if (edges.length > 0) {
      await db.connections.bulkPut(edges);
      generatedEdges += edges.length;
    }

    processedStopTimes += records.length;
    const lastRecord = records[records.length - 1];
    lastKey = [lastRecord.tripId, lastRecord.stopSequence];

    onProgress?.(processedStopTimes, totalStopTimes);
  }

  return {
    processedStopTimes,
    generatedEdges,
    storedConnections: await db.connections.count(),
  };
}