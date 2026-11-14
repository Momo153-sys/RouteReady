
import type { Agency } from '../../domain/agencies';
import type { Stop } from '../../domain/stops';
import type { Route, Trip } from '../../domain/routes';
import type { ServiceCalendar } from '../../domain/services';

import {
  saveStopTimes,
  validateStopTimeReferences,
} from '../../repositories/stop-time.repository';

import {
  importStopTimesStream,
  type StopTimesImportProgress,
} from './stop-times-stream';

import { validateGtfsRelationships } from './relationship-validation';
import { getDatabase } from '../../database/dexie';

import { saveAgencies } from '../../repositories/agency.repository';
import { saveStops } from '../../repositories/stop.repository';
import { saveRoutes, saveTrips } from '../../repositories/route.repository';

import {
  saveServices,
  saveServiceCalendars,
} from '../../repositories/service.repository';

import { parseCsv } from './csv-parser';

import {
  mapAgencyRecord,
  mapStopRecord,
  mapRouteRecord,
  mapServiceCalendarRecord,
  mapTripRecord,
} from './mappers';

export interface GtfsDatabaseImportResult {
  agenciesImported: number;
  stopsImported: number;
  routesImported: number;
  calendarsImported: number;
  tripsImported: number;
  stopTimesImported: number;
}

export type GtfsImportStage =
  | 'fetching'
  | 'validating'
  | 'agencies-stops'
  | 'routes-trips'
  | 'stop-times'
  | 'connections'
  | 'walking'
  | 'completed'
  | 'failed';

export interface GtfsImportProgress {
  stage: GtfsImportStage;
  message: string;
  processed?: number;
  total?: number;
  batches?: number;
  error?: string;
}

async function fetchCsv<T extends Record<string, string>>(
  path: string,
  delimiter?: ',' | ';'
): Promise<T[]> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  const content = await response.text();
  console.log('[GTFS CSV DEBUG]', {
  requestedPath: path,
  responseUrl: response.url,
  status: response.status,
  contentPreview: content.slice(0, 500),
});


  const result = parseCsv<T>(content, {
  delimiter: delimiter ?? ',',
});

  if (result.errors.length > 0) {
    throw new Error(
      `CSV parsing failed for ${path}:\n${result.errors.join('\n')}`
    );
  }

  return result.data;
}

function reportProgress(
  callback: ((progress: GtfsImportProgress) => void) | undefined,
  progress: GtfsImportProgress
): void {
  callback?.(progress);
}

export async function importAgenciesAndStops(
  agencies: Agency[],
  stops: Stop[]
): Promise<{ agenciesImported: number; stopsImported: number }> {
  const db = getDatabase();

  await db.transaction(
    'rw',
    db.agencies,
    db.stops,
    async () => {
      await saveAgencies(agencies);
      await saveStops(stops);
    }
  );

  return {
    agenciesImported: agencies.length,
    stopsImported: stops.length,
  };
}

export async function importRoutesServicesAndTrips(
  routes: Route[],
  calendars: ServiceCalendar[],
  trips: Trip[]
): Promise<void> {
  const db = getDatabase();

  await db.transaction(
    'rw',
    db.services,
    db.serviceCalendars,
    db.routes,
    db.trips,
    async () => {
      const serviceIds = [
        ...new Set([
          ...calendars.map((calendar) => calendar.serviceId),
          ...trips.map((trip) => trip.serviceId),
        ]),
      ];

      await saveServices(serviceIds);
      await saveRoutes(routes);
      await saveServiceCalendars(calendars);
      await saveTrips(trips);
    }
  );
}

export async function importGtfsData(
  onProgress?: (progress: GtfsImportProgress) => void
): Promise<GtfsDatabaseImportResult> {
  try {
    reportProgress(onProgress, {
      stage: 'fetching',
      message: 'Loading transit data files...',
    });

    const [
      agencyRecords,
      stopRecords,
      routeRecords,
      calendarRecords,
      tripRecords,
    ] = await Promise.all([
      fetchCsv('data/agency.csv'),
      fetchCsv('data/stops-clean.csv'),
      fetchCsv('data/routes.csv', ','),
fetchCsv('data/calendar.csv', ','),
fetchCsv('data/trips.csv', ','),
    ]);

    reportProgress(onProgress, {
      stage: 'validating',
      message: 'Validating transit data...',
    });

    const supportedRouteTypes = new Set(['0', '1', '2', '3', '4']);

const validRouteRecords = routeRecords.filter(
  (record) =>
    record.route_id?.trim() !== '' &&
    (
      record.route_type?.trim() === '' ||
      supportedRouteTypes.has(record.route_type.trim())
    )
);

const skippedRouteRecords =
  routeRecords.length - validRouteRecords.length;

console.log(
  `[GTFS IMPORT] Skipped ${skippedRouteRecords} records with missing route IDs or unsupported route types.`
);
const missingReferencedRouteIds = [
  ...new Set(
    tripRecords
      .map((trip) => trip.route_id?.trim())
      .filter(
        (routeId) =>
          routeId &&
          !validRouteRecords.some(
            (route) => route.route_id?.trim() === routeId
          )
      )
  ),
];

console.log(
  '[GTFS MISSING ROUTES]',
  JSON.stringify(
    {
      routeIds: missingReferencedRouteIds,
      matchingSourceRecords: routeRecords.filter((route) =>
        missingReferencedRouteIds.includes(route.route_id?.trim())
      ),
    },
    null,
    2
  )
);

    const validation = validateGtfsRelationships({
      agencies: agencyRecords,
      stops: stopRecords,
      routes: validRouteRecords,
      calendars: calendarRecords,
      trips: tripRecords,
    });

    if (!validation.valid) {
      throw new Error(
        `GTFS relationship validation failed:\n${validation.errors.join('\n')}`
      );
    }

    const agencies = agencyRecords.map(mapAgencyRecord);
    const stops = stopRecords.map(mapStopRecord);
    const routes = validRouteRecords.map(mapRouteRecord);
    const calendars = calendarRecords.map(mapServiceCalendarRecord);
    const trips = tripRecords.map(mapTripRecord);

    reportProgress(onProgress, {
      stage: 'agencies-stops',
      message: 'Importing agencies and stops...',
    });

    const basicImport = await importAgenciesAndStops(agencies, stops);

    reportProgress(onProgress, {
      stage: 'routes-trips',
      message: 'Importing routes, services and trips...',
    });

    await importRoutesServicesAndTrips(routes, calendars, trips);

    reportProgress(onProgress, {
      stage: 'stop-times',
      message: 'Importing stop schedules...',
    });

    const stopTimesImported = await importStopTimesData(
      (progress: StopTimesImportProgress) => {
        reportProgress(onProgress, {
          stage: 'stop-times',
          message: `Importing stop schedules: ${progress.processed.toLocaleString()} records processed`,
          processed: progress.processed,
          batches: progress.batches,
        });
      }
    );

    const result: GtfsDatabaseImportResult = {
      ...basicImport,
      routesImported: routes.length,
      calendarsImported: calendars.length,
      tripsImported: trips.length,
      stopTimesImported,
    };

    reportProgress(onProgress, {
      stage: 'completed',
      message: 'Transit data imported successfully.',
      processed: stopTimesImported,
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    reportProgress(onProgress, {
      stage: 'failed',
      message: 'Transit data import failed.',
      error: message,
    });

    throw error;
  }
}

export async function importStopTimesData(
  onProgress?: (progress: StopTimesImportProgress) => void
): Promise<number> {
  const db = getDatabase();

  const response = await fetch('data/stop_times.txt');

  if (!response.ok) {
    throw new Error(
      `Failed to fetch stop_times.txt: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error('The stop_times.txt response has no readable stream.');
  }

  let committedRecords = 0;
let batchNumber = 0;

const result = await importStopTimesStream(
  response.body,
  async (batch) => {
    batchNumber++;

    await db.transaction(
      'rw',
      db.stopTimes,
      db.trips,
      db.stops,
      async () => {
        const errors = await validateStopTimeReferences(batch);

        if (errors.length > 0) {
          throw new Error(
            `Stop-time reference validation failed:\n${errors.join('\n')}`
          );
        }

        await saveStopTimes(batch);
      }
    );

    committedRecords += batch.length;

    if (batchNumber % 100 === 0) {
      console.log('[STOP TIMES IMPORT]', {
        batchNumber,
        committedRecords,
        storedRecords: await db.stopTimes.count(),
      });
    }
  },
  onProgress
);

console.log('[STOP TIMES IMPORT COMPLETED]', {
  parsedRecords: result.processed,
  committedRecords,
  storedRecords: await db.stopTimes.count(),
  batches: result.batches,
});

  return result.processed;
}
