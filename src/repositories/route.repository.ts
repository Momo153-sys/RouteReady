
import { getDatabase } from '../database/dexie';
import type { Route, Trip } from '../domain/routes';

export async function saveRoute(route: Route): Promise<void> {
  await getDatabase().routes.put(route);
}

export async function saveRoutes(routes: Route[]): Promise<void> {
  if (routes.length === 0) return;

  await getDatabase().routes.bulkPut(routes);
}

export async function getRouteById(
  id: string
): Promise<Route | null> {
  return (await getDatabase().routes.get(id)) ?? null;
}

export async function getAllRoutes(): Promise<Route[]> {
  return getDatabase().routes.orderBy('shortName').toArray();
}

export async function saveTrip(trip: Trip): Promise<void> {
  await getDatabase().trips.put(trip);
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  if (trips.length === 0) return;

  await getDatabase().trips.bulkPut(trips);
}

export async function getTripsByRouteId(
  routeId: string
): Promise<Trip[]> {
  return getDatabase().trips.where('routeId').equals(routeId).toArray();
}
