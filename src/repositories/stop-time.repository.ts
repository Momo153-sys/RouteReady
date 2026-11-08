
import { getDatabase } from '../database/dexie';

export interface StopTime {
  id?: number;
  tripId: string;
  stopId: string;
  arrivalTime: string | null;
  departureTime: string | null;
  stopSequence: number;
  timepoint: boolean;
}

export async function saveStopTime(
  stopTime: StopTime
): Promise<void> {
  await getDatabase().stopTimes.put(stopTime);
}

export async function saveStopTimes(
  stopTimes: StopTime[]
): Promise<void> {
  if (stopTimes.length === 0) return;

  await getDatabase().stopTimes.bulkPut(stopTimes);
}

export async function getStopTimesByTripId(
  tripId: string
): Promise<StopTime[]> {
  return getDatabase()
    .stopTimes
    .where('tripId')
    .equals(tripId)
    .sortBy('stopSequence');
}

export async function validateStopTimeReferences(
  stopTimes: StopTime[]
): Promise<string[]> {
  if (stopTimes.length === 0) return [];

  const db = getDatabase();

  const tripIds = [...new Set(stopTimes.map((item) => item.tripId))];
  const stopIds = [...new Set(stopTimes.map((item) => item.stopId))];

  const existingTrips = await db.trips.bulkGet(tripIds);
  const existingStops = await db.stops.bulkGet(stopIds);

  const existingTripIds = new Set(
    existingTrips
      .filter((trip) => trip !== undefined)
      .map((trip) => trip.id)
  );

  const existingStopIds = new Set(
    existingStops
      .filter((stop) => stop !== undefined)
      .map((stop) => stop.id)
  );

  const errors: string[] = [];

  for (const tripId of tripIds) {
    if (!existingTripIds.has(tripId)) {
      errors.push(`Unknown trip_id: ${tripId}`);
    }
  }

  for (const stopId of stopIds) {
    if (!existingStopIds.has(stopId)) {
      errors.push(`Unknown stop_id: ${stopId}`);
    }
  }

  return errors;
}

export async function diagnoseStopTimes() {
  const db = getDatabase();

  const first = await db.stopTimes
    .orderBy('[tripId+stopSequence]')
    .first();

  if (!first) return;

  const records = await db.stopTimes
    .where('tripId')
    .equals(first.tripId)
    .sortBy('stopSequence');

  console.table(
    records.map((item) => ({
      stopSequence: item.stopSequence,
      stopId: item.stopId,
      arrivalTime: item.arrivalTime,
      departureTime: item.departureTime,
      timepoint: item.timepoint,
    }))
  );

  console.log('Trip diagnostic:', {
    tripId: first.tripId,
    totalStops: records.length,
    timedStops: records.filter(
      (item) => item.arrivalTime || item.departureTime
    ).length,
  });
}