import Dexie, { type Table } from 'dexie';
import type { WalkingEdge } from '../domain/walking-edge';
import type { OSMRoute, OSMStop } from '../lib/import/osm-parser';
import type { Agency } from '../domain/agencies';
import type { Stop } from '../domain/stops';
import type { Route, Trip } from '../domain/routes';
import type { StopTime } from '../repositories/stop-time.repository';
import type { SavedPlace } from '../repositories/saved-place.repository';
import type {
  ServiceCalendar,
  ServiceException,
} from '../domain/services';
import type { TransitEdge } from '../domain/transit-edge';

class RouteReadyDatabase extends Dexie {
  stops!: Table<Stop, string>;
  agencies!: Table<Agency, string>;
  routes!: Table<Route, string>;
  trips!: Table<Trip, string>;
  savedPlaces!: Table<SavedPlace, string>;
  stopTimes!: Table<StopTime, [string, number]>;
  services!: Table<{ serviceId: string }, string>;
  serviceCalendars!: Table<ServiceCalendar, string>;
  serviceExceptions!: Table<ServiceException, [string, string]>;
  connections!: Table<TransitEdge, [string, string, string]>;
  walkingEdges!: Table<WalkingEdge, [string, string]>;
  osmStops!: Table<OSMStop, string>;
osmRoutes!: Table<OSMRoute, string>;

  constructor() {
    super('routeready');

    this.version(1).stores({
      stops: 'id, name, code',
    });

    this.version(2).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
    });

    this.version(3).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
      routes: 'id, agencyId, shortName, routeType',
      trips: 'id, routeId, serviceId',
    });

    this.version(4).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
      routes: 'id, agencyId, shortName, routeType',
      trips: 'id, routeId, serviceId',
      services: 'serviceId',
      serviceCalendars: 'serviceId',
      serviceExceptions: '[serviceId+date], serviceId, date',
    });

    this.version(5).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
      routes: 'id, agencyId, shortName, routeType',
      trips: 'id, routeId, serviceId',
      services: 'serviceId',
      serviceCalendars: 'serviceId',
      serviceExceptions: '[serviceId+date], serviceId, date',
      savedPlaces: 'id, name',
    });

    this.version(6).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
      routes: 'id, agencyId, shortName, routeType',
      trips: 'id, routeId, serviceId',
      services: 'serviceId',
      serviceCalendars: 'serviceId',
      serviceExceptions: '[serviceId+date], serviceId, date',
      savedPlaces: 'id, name',
      stopTimes: '[tripId+stopSequence], tripId, stopId',
    });

    this.version(7).stores({
      stops: 'id, name, code',
      agencies: 'id, name',
      routes: 'id, agencyId, shortName, routeType',
      trips: 'id, routeId, serviceId',
      services: 'serviceId',
      serviceCalendars: 'serviceId',
      serviceExceptions: '[serviceId+date], serviceId, date',
      savedPlaces: 'id, name',
      stopTimes: '[tripId+stopSequence], tripId, stopId',
      connections:
        '[routeId+fromStopId+toStopId], fromStopId, toStopId, routeId, [fromStopId+routeId]',
    });

    this.version(8).stores({
  stops: 'id, name, code',
  agencies: 'id, name',
  routes: 'id, agencyId, shortName, routeType',
  trips: 'id, routeId, serviceId',
  services: 'serviceId',
  serviceCalendars: 'serviceId',
  serviceExceptions: '[serviceId+date], serviceId, date',
  savedPlaces: 'id, name',
  stopTimes: '[tripId+stopSequence], tripId, stopId',
  connections:
    '[routeId+fromStopId+toStopId], fromStopId, toStopId, routeId, [fromStopId+routeId]',
  walkingEdges:
    '[fromStopId+toStopId], fromStopId, toStopId',
});

this.version(9).stores({
  osmStops: 'id, name',
  osmRoutes: 'id, ref, name, type',
});
  }
}

const db = new RouteReadyDatabase();

export async function initializeDatabase(): Promise<RouteReadyDatabase> {
  await db.open();
  return db;
}

export function getDatabase(): RouteReadyDatabase {
  return db;
}

export async function getStopCount(): Promise<number> {
  return db.stops.count();
}

export async function verifyDatabase(): Promise<string[]> {
  return db.tables.map(table => table.name);
}