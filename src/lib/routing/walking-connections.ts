
import { getDatabase } from '../../database/dexie';
import type { Stop } from '../../domain/stops';
import type { WalkingEdge } from '../../domain/walking-edge';

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_DEGREE_LATITUDE = 111_320;

const MAX_WALKING_DISTANCE_METERS = 300;
const WALKING_SPEED_KMH = 4.5;

type CoordinateStop = Stop & {
  latitude: number;
  longitude: number;
};

function calculateDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);
  const deltaLat = toRadians(latitude2 - latitude1);
  const deltaLon = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * centralAngle;
}

function hasValidCoordinates(
  stop: Stop
): stop is CoordinateStop {
  return (
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    Number.isFinite(stop.latitude) &&
    Number.isFinite(stop.longitude) &&
    stop.latitude >= -90 &&
    stop.latitude <= 90 &&
    stop.longitude >= -180 &&
    stop.longitude <= 180
  );
}

function getCellKey(latitude: number, longitude: number): string {
  return `${latitude}:${longitude}`;
}

export async function generateWalkingConnections(): Promise<number> {
  const db = getDatabase();

  const [gtfsStops, osmStops] = await Promise.all([
  db.stops.toArray(),
  db.osmStops.toArray(),
]);

const stops = [
  ...gtfsStops,
  ...osmStops.map(stop => ({
    ...stop,
    locationType: 0,
  })),
].filter(hasValidCoordinates);

  if (stops.length === 0) {
    return 0;
  }

  const latitudeCellSize =
    MAX_WALKING_DISTANCE_METERS / METERS_PER_DEGREE_LATITUDE;

  const averageLatitude =
  stops.reduce((sum, stop) => sum + stop.latitude, 0) /
  stops.length;

  const longitudeMetersPerDegree =
  METERS_PER_DEGREE_LATITUDE *
  Math.cos((averageLatitude * Math.PI) / 180);

  const longitudeCellSize =
  MAX_WALKING_DISTANCE_METERS /
  longitudeMetersPerDegree;

  const grid = new Map<string, CoordinateStop[]>();
  const walkingEdges: WalkingEdge[] = [];

  for (const stop of stops) {
    const latitudeCell = Math.floor(
      stop.latitude / latitudeCellSize
    );

    const longitudeCell = Math.floor(
      stop.longitude / longitudeCellSize
    );

    // Inspect the current cell and its eight neighbors.
    for (let latOffset = -1; latOffset <= 1; latOffset++) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset++) {
        const key = getCellKey(
          latitudeCell + latOffset,
          longitudeCell + lonOffset
        );

        const nearbyStops = grid.get(key) ?? [];

        for (const nearbyStop of nearbyStops) {
          const distanceMeters = calculateDistanceMeters(
            stop.latitude,
            stop.longitude,
            nearbyStop.latitude,
            nearbyStop.longitude
          );

          if (
            distanceMeters > MAX_WALKING_DISTANCE_METERS
          ) {
            continue;
          }

          const roundedDistance = Math.round(distanceMeters);

          const durationMinutes = Math.max(
            1,
            Math.ceil(
              (distanceMeters / (WALKING_SPEED_KMH * 1000)) * 60
            )
          );

          // Add both walking directions.
          walkingEdges.push({
            fromStopId: stop.id,
            toStopId: nearbyStop.id,
            distanceMeters: roundedDistance,
            durationMinutes,
          });

          walkingEdges.push({
            fromStopId: nearbyStop.id,
            toStopId: stop.id,
            distanceMeters: roundedDistance,
            durationMinutes,
          });
        }
      }
    }

    // Insert the current stop after checking previous stops.
    const currentCellKey = getCellKey(
      latitudeCell,
      longitudeCell
    );

    const currentCell = grid.get(currentCellKey) ?? [];
    currentCell.push(stop);
    grid.set(currentCellKey, currentCell);
  }

  await db.transaction('rw', db.walkingEdges, async () => {
    await db.walkingEdges.clear();

    if (walkingEdges.length > 0) {
      await db.walkingEdges.bulkPut(walkingEdges);
    }
  });

  return walkingEdges.length;
}
