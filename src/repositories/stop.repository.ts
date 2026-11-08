
import { getDatabase } from '../database/dexie';
import type { Stop } from '../domain/stops';

export interface NearbyStop {
  stop: Stop;
  distanceKm: number;
}

// Temporarily hide the unavailable F1 Taksim stop.
const HIDDEN_STOP_IDS = new Set(['osm:5607774263']);

export async function saveStop(stop: Stop): Promise<void> {
  await getDatabase().stops.put(stop);
}

export async function getStopById(id: string): Promise<Stop | null> {
  const db = getDatabase();

  const gtfsStop = await db.stops.get(id);
  if (gtfsStop) return gtfsStop;

  const osmStop = await db.osmStops.get(id);
  if (!osmStop) return null;

  return {
    id: osmStop.id,
    name: osmStop.name,
    description: osmStop.description,
    latitude: osmStop.latitude,
    longitude: osmStop.longitude,
    locationType: 0,
  };
}

export async function getAllStops(): Promise<Stop[]> {
  const db = getDatabase();

  const [gtfsStops, osmStops] = await Promise.all([
    db.stops.toArray(),
    db.osmStops.toArray(),
  ]);

  return [
    ...gtfsStops,
    ...osmStops.map(
      (stop): Stop => ({
        id: stop.id,
        name: stop.name,
        description: stop.description,
        latitude: stop.latitude,
        longitude: stop.longitude,
        locationType: 0,
      }),
    ),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getNearbyStops(
  latitude: number,
  longitude: number,
  radiusKm = 1,
): Promise<NearbyStop[]> {
  const stops = await getAllStops();

  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  return stops
    .filter(
      (stop) =>
        !HIDDEN_STOP_IDS.has(stop.id) &&
        stop.latitude !== undefined &&
        stop.longitude !== undefined,
    )
    .map((stop) => {
      const latDifference = toRadians(stop.latitude! - latitude);
      const lonDifference = toRadians(stop.longitude! - longitude);

      const a =
        Math.sin(latDifference / 2) ** 2 +
        Math.cos(toRadians(latitude)) *
          Math.cos(toRadians(stop.latitude!)) *
          Math.sin(lonDifference / 2) ** 2;

      const distanceKm =
        2 *
        earthRadiusKm *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return { stop, distanceKm };
    })
    .filter(({ distanceKm }) => distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function saveStops(stops: Stop[]): Promise<void> {
  if (stops.length === 0) return;

  await getDatabase().stops.bulkPut(stops);
}

export async function searchStops(query: string): Promise<Stop[]> {
  const trimmedQuery = query.trim().toLocaleLowerCase();

  if (!trimmedQuery) return [];

  const stops = await getAllStops();

  return stops
    .filter(
      (stop) =>
        !HIDDEN_STOP_IDS.has(stop.id) &&
        (
          stop.name.toLocaleLowerCase().includes(trimmedQuery) ||
          (stop.code?.toLocaleLowerCase().includes(trimmedQuery) ?? false)
        ),
    )
    .sort((a, b) => {
      const aExact =
        a.name.toLocaleLowerCase() === trimmedQuery ||
        a.code?.toLocaleLowerCase() === trimmedQuery;

      const bExact =
        b.name.toLocaleLowerCase() === trimmedQuery ||
        b.code?.toLocaleLowerCase() === trimmedQuery;

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      return a.name.localeCompare(b.name);
    })
    .slice(0, 30);
}
