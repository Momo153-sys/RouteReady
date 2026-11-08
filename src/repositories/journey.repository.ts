
import { getDatabase } from '../database/dexie';

import type { Journey } from '../lib/routing/connection-scan';
import type { Stop } from '../domain/stops';
import type { TransitEdge } from '../domain/transit-edge';

async function reconstructTransitSegment(
  leg: Extract<Journey['legs'][number], { type: 'transit' }>,
  db: ReturnType<typeof getDatabase>
): Promise<string[]> {
  const edges: TransitEdge[] = await db.connections
    .where('routeId')
    .equals(leg.routeId)
    .toArray();

  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const destinations = adjacency.get(edge.fromStopId) ?? [];

    destinations.push(edge.toStopId);
    adjacency.set(edge.fromStopId, destinations);
  }

  const queue: string[] = [leg.fromStopId];
  const visited = new Set<string>([leg.fromStopId]);
  const previous = new Map<string, string>();

  let head = 0;
  let found = false;

  while (head < queue.length) {
    const currentStopId = queue[head++];

    if (currentStopId === leg.toStopId) {
      found = true;
      break;
    }

    const nextStops = adjacency.get(currentStopId) ?? [];

    for (const nextStopId of nextStops) {
      if (visited.has(nextStopId)) {
        continue;
      }

      visited.add(nextStopId);
      previous.set(nextStopId, currentStopId);
      queue.push(nextStopId);
    }
  }

  if (!found) {
    console.warn(
      `Could not reconstruct route ${leg.routeId} from ${leg.fromStopId} to ${leg.toStopId}`
    );

    return [leg.fromStopId, leg.toStopId];
  }

  const segment: string[] = [];
  let currentStopId = leg.toStopId;

  while (currentStopId !== leg.fromStopId) {
    segment.push(currentStopId);

    const parent = previous.get(currentStopId);

    if (!parent) {
      return [leg.fromStopId, leg.toStopId];
    }

    currentStopId = parent;
  }

  segment.push(leg.fromStopId);
  segment.reverse();

  return segment;
}

/**
 * Reconstructs the ordered stops for a journey,
 * supporting both transit and walking legs.
 */
export async function getJourneyStops(
  journey: Journey
): Promise<Stop[]> {
  const db = getDatabase();

  return db.transaction(
    'r',
    [db.connections, db.stops],
    async () => {
      const journeyStopIds: string[] = [journey.originStopId];

      for (const leg of journey.legs) {
        let segment: string[];

        if (leg.type === 'walking') {
          segment = [leg.fromStopId, leg.toStopId];
        } else {
          segment = await reconstructTransitSegment(leg, db);
        }

        for (const stopId of segment) {
          if (
            journeyStopIds[journeyStopIds.length - 1] !== stopId
          ) {
            journeyStopIds.push(stopId);
          }
        }
      }

      if (
        journeyStopIds[journeyStopIds.length - 1] !==
        journey.destinationStopId
      ) {
        journeyStopIds.push(journey.destinationStopId);
      }

      const stops = await db.stops.bulkGet(journeyStopIds);

      const stopMap = new Map(
        stops
          .filter((stop): stop is Stop => stop !== undefined)
          .map(stop => [stop.id, stop])
      );

      return journeyStopIds
        .map(stopId => stopMap.get(stopId))
        .filter((stop): stop is Stop => stop !== undefined);
    }
  );
}
