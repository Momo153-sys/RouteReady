import { getDatabase } from '../database/dexie';

export async function diagnoseTransitConnections() {
  const db = getDatabase();

  console.log('Starting transit connection diagnostic...');

  const [
    tripCount,
    routeCount,
    stopCount,
    stopTimeCount,
  ] = await Promise.all([
    db.trips.count(),
    db.routes.count(),
    db.stops.count(),
    db.stopTimes.count(),
  ]);

  console.log('Database totals:', {
    trips: tripCount,
    routes: routeCount,
    stops: stopCount,
    stopTimes: stopTimeCount,
  });

  const tripIds = new Set<string>();
  const routeIds = new Set<string>();
  const stopIds = new Set<string>();

  let validTrips = 0;
  let invalidRouteTrips = 0;
  let invalidStopReferences = 0;
  let connectionCount = 0;

  const examples: Array<{
    routeName: string;
    fromStop: string;
    toStop: string;
  }> = [];

  const [routes, stops] = await Promise.all([
    db.routes.toArray(),
    db.stops.toArray(),
  ]);

  const routeMap = new Map(
    routes.map(route => [route.id, route])
  );

  const stopMap = new Map(
    stops.map(stop => [stop.id, stop])
  );

  const trips = await db.trips.toArray();

  for (const trip of trips) {
    tripIds.add(trip.id);

    const route = routeMap.get(trip.routeId);

    if (!route) {
      invalidRouteTrips++;
      continue;
    }

    routeIds.add(route.id);

    const stopTimes = await db.stopTimes
      .where('tripId')
      .equals(trip.id)
      .sortBy('stopSequence');

    if (stopTimes.length < 2) continue;

    validTrips++;

    for (let i = 0; i < stopTimes.length - 1; i++) {
      const current = stopTimes[i];
      const next = stopTimes[i + 1];

      const fromStop = stopMap.get(current.stopId);
      const toStop = stopMap.get(next.stopId);

      if (!fromStop || !toStop) {
        invalidStopReferences++;
        continue;
      }

      if (fromStop.id === toStop.id) continue;

      stopIds.add(fromStop.id);
      stopIds.add(toStop.id);
      connectionCount++;

      if (examples.length < 10) {
        examples.push({
          routeName: route.shortName,
          fromStop: fromStop.name,
          toStop: toStop.name,
        });
      }
    }
  }

  const report = {
    database: {
      trips: tripCount,
      routes: routeCount,
      stops: stopCount,
      stopTimes: stopTimeCount,
    },
    routing: {
      tripsWithAtLeastTwoStops: validTrips,
      tripsWithMissingRoutes: invalidRouteTrips,
      invalidStopReferences,
      generatedConnections: connectionCount,
      stopsParticipatingInConnections: stopIds.size,
      routesParticipatingInConnections: routeIds.size,
    },
    examples,
  };

  console.log('Transit connection diagnostic:', report);

  return report;
}

export async function diagnoseTripStopTimeDistribution() {
  const db = getDatabase();

  const stopCounts = new Map<string, number>();

  await db.stopTimes
    .orderBy('tripId')
    .each(stopTime => {
      stopCounts.set(
        stopTime.tripId,
        (stopCounts.get(stopTime.tripId) ?? 0) + 1
      );
    });

  const trips = await db.trips.toArray();

  let zeroStops = 0;
  let oneStop = 0;
  let twoOrMoreStops = 0;

  const missingExamples: string[] = [];

  for (const trip of trips) {
    const count = stopCounts.get(trip.id) ?? 0;

    if (count === 0) {
      zeroStops++;
      if (missingExamples.length < 10) {
        missingExamples.push(trip.id);
      }
    } else if (count === 1) {
      oneStop++;
    } else {
      twoOrMoreStops++;
    }
  }

  const report = {
    totalTrips: trips.length,
    zeroStops,
    oneStop,
    twoOrMoreStops,
    tripsWithStopTimes: stopCounts.size,
    missingExamples,
  };

  console.log('Trip stop-time distribution:', report);

  return report;
}