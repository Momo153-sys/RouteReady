import { parseCsv } from './csv-parser';
import { validateRequiredFields, isValidGtfsWeekdayFlag, isValidStopSequence } from './validation';
import {
  isValidGtfsDate,
  isValidGtfsDateRange,
  isValidTimepoint,
  isValidDirectionId,
  isValidLocationType,
  isValidRouteType,
} from './validation';
import {
  mapAgencyRecord,
  mapStopRecord,
  mapRouteRecord,
  mapServiceCalendarRecord,
  mapTripRecord,
  mapStopTimeRecord,
} from './mappers';

export interface GtfsImportFiles {
  agency: string;
  stops: string;
  routes: string;
  calendar: string;
  trips: string;
  stopTimes: string;
}


export function parseGtfsFiles(files: GtfsImportFiles) {
  return {
    agency: parseCsv(files.agency),
    stops: parseCsv(files.stops, { delimiter: ';' }),
    routes: parseCsv(files.routes),
    calendar: parseCsv(files.calendar),
    trips: parseCsv(files.trips),
    stopTimes: parseCsv(files.stopTimes),
  };
}


export function validateGtfsFiles(
  parsed: ReturnType<typeof parseGtfsFiles>
) {
  return {
    duplicateErrors: {
  agency: findDuplicateIds(parsed.agency.data, 'agency_id'),
  stops: findDuplicateIds(parsed.stops.data, 'stop_id'),
  routes: findDuplicateIds(parsed.routes.data, 'route_id'),
  calendar: findDuplicateIds(parsed.calendar.data, 'service_id'),
  trips: findDuplicateIds(parsed.trips.data, 'trip_id'),
  stopTimes: findDuplicateStopTimeSequences(parsed.stopTimes.data),
},


    parserErrors: {
      agency: parsed.agency.errors,
      stops: parsed.stops.errors,
      routes: parsed.routes.errors,
      calendar: parsed.calendar.errors,
      trips: parsed.trips.errors,
      stopTimes: parsed.stopTimes.errors,
    },

    agency: validateRequiredFields(parsed.agency.data, [
      'agency_id',
      'agency_name',
      'agency_url',
      'agency_timezone',
    ]),

    stops: validateRequiredFields(parsed.stops.data, [
      'stop_id',
      'stop_name',
      'stop_lat',
      'stop_lon',
    ]),

    routes: validateRequiredFields(parsed.routes.data, [
      'route_id',
      'agency_id',
      'route_short_name',
      'route_long_name',
      'route_type',
    ]),

    calendar: validateRequiredFields(parsed.calendar.data, [
      'service_id',
      'service_name',
      'start_date',
      'end_date',
    ]),
    calendarValueErrors: parsed.calendar.data.flatMap((record, index) => {
  const errors: string[] = [];

  if (!isValidGtfsDate(record.start_date)) {
    errors.push(
      `calendar: Row ${index + 1}: invalid start_date ${record.start_date}.`
    );
  }

  if (!isValidGtfsDate(record.end_date)) {
    errors.push(
      `calendar: Row ${index + 1}: invalid end_date ${record.end_date}.`
    );
  }

  if (
    isValidGtfsDate(record.start_date) &&
    isValidGtfsDate(record.end_date) &&
    !isValidGtfsDateRange(record.start_date, record.end_date)
  ) {
    errors.push(
      `calendar: Row ${index + 1}: start_date is after end_date.`
    );
  }

  return errors;
}),

    trips: validateRequiredFields(parsed.trips.data, [
      'trip_id',
      'route_id',
      'service_id',
    ]),

    stopTimes: validateRequiredFields(parsed.stopTimes.data, [
      'trip_id',
      'stop_id',
      'stop_sequence',
    ]),
  };
}


export function mapValidatedGtfsFiles(
  validated: ReturnType<typeof validateGtfsFiles>
) {
  return {
    agencies: validated.agency.validRecords.map(mapAgencyRecord),
    stops: validated.stops.validRecords.map(mapStopRecord),
    routes: validated.routes.validRecords.map(mapRouteRecord),
    calendars: validated.calendar.validRecords.map(
      mapServiceCalendarRecord
    ),
    trips: validated.trips.validRecords.map(mapTripRecord),
    stopTimes: validated.stopTimes.validRecords.map(mapStopTimeRecord),
  };
}

export function getGtfsImportErrors(
  validated: ReturnType<typeof validateGtfsFiles>
): string[] {
  const datasets = [
    'agency',
    'stops',
    'routes',
    'calendar',
    'trips',
    'stopTimes',
  ] as const;

  const errors: string[] = [];
  errors.push(...validateGtfsRelationships(validated));

  for (const dataset of datasets) {
    
    for (const error of validated.parserErrors[dataset]) {
      errors.push(`${dataset}: ${error}`);
    }

    for (const id of validated.duplicateErrors[dataset]) {
  errors.push(`${dataset}: duplicate ID ${id}.`);
}

    for (const error of validated[dataset].errors) {
      errors.push(`${dataset}: ${error}`);
    }
  }
  errors.push(...validated.calendarValueErrors);
  errors.push(...validateCalendarWeekdayFlags(validated.calendar.validRecords));
  errors.push(...validateStopSequences(validated.stopTimes.validRecords));
  errors.push(...validateTimepoints(validated.stopTimes.validRecords));
  errors.push(...validateDirectionIds(validated.trips.validRecords));
  errors.push(...validateLocationTypes(validated.stops.validRecords));
  errors.push(...validateRouteTypes(validated.routes.validRecords));

  return errors;
}

export function canImportGtfs(
  validated: ReturnType<typeof validateGtfsFiles>
): boolean {
  return getGtfsImportErrors(validated).length === 0;
}

export function validateGtfsRelationships(
  validated: ReturnType<typeof validateGtfsFiles>
): string[] {
  const errors: string[] = [];

  const agencyIds = new Set(
    validated.agency.validRecords.map((record) => record.agency_id)
  );

  const stopIds = new Set(
    validated.stops.validRecords.map((record) => record.stop_id)
  );

  const routeIds = new Set(
    validated.routes.validRecords.map((record) => record.route_id)
  );

  const serviceIds = new Set(
    validated.calendar.validRecords.map((record) => record.service_id)
  );

  const tripIds = new Set(
    validated.trips.validRecords.map((record) => record.trip_id)
  );

  validated.routes.validRecords.forEach((route, index) => {
    if (!agencyIds.has(route.agency_id)) {
      errors.push(
        `routes: Row ${index + 1}: agency_id ${route.agency_id} does not exist.`
      );
    }
  });

  validated.trips.validRecords.forEach((trip, index) => {
    if (!routeIds.has(trip.route_id)) {
      errors.push(
        `trips: Row ${index + 1}: route_id ${trip.route_id} does not exist.`
      );
    }

    if (!serviceIds.has(trip.service_id)) {
      errors.push(
        `trips: Row ${index + 1}: service_id ${trip.service_id} does not exist.`
      );
    }
  });

  validated.stopTimes.validRecords.forEach((stopTime, index) => {
    if (!tripIds.has(stopTime.trip_id)) {
      errors.push(
        `stopTimes: Row ${index + 1}: trip_id ${stopTime.trip_id} does not exist.`
      );
    }

    if (!stopIds.has(stopTime.stop_id)) {
      errors.push(
        `stopTimes: Row ${index + 1}: stop_id ${stopTime.stop_id} does not exist.`
      );
    }
  });

  return errors;
}

export function findDuplicateIds(
  records: Record<string, string>[],
  idField: string
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    const id = record[idField];

    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return [...duplicates];
}

export function findDuplicateStopTimeSequences(
  records: Record<string, string>[]
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    const key = `${record.trip_id}:${record.stop_sequence}`;

    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }

  return [...duplicates];
}

function validateCalendarWeekdayFlags(
  records: Record<string, string>[]
): string[] {
  const weekdayFields = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const errors: string[] = [];
  

  records.forEach((record, index) => {
    weekdayFields.forEach((field) => {
      if (!isValidGtfsWeekdayFlag(record[field] ?? '')) {
        errors.push(
          `calendar: Row ${index + 1}: invalid ${field} value "${record[field]}".`
        );
      }
    });
  });

  return errors;
}

function validateStopSequences(
  records: Record<string, string>[]
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    if (!isValidStopSequence(record.stop_sequence ?? '')) {
      errors.push(
        `stopTimes: Row ${index + 1}: invalid stop_sequence value "${record.stop_sequence}".`
      );
    }
  });

  return errors;
}

function validateTimepoints(
  records: Record<string, string>[]
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    if (!isValidTimepoint(record.timepoint ?? '1')) {
      errors.push(
        `stopTimes: Row ${index + 1}: invalid timepoint value "${record.timepoint}".`
      );
    }
  });

  return errors;
}

function validateDirectionIds(
  records: Record<string, string>[],
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    if (!isValidDirectionId(record.direction_id ?? '')) {
      errors.push(
        `trips: Row ${index + 1}: invalid direction_id "${record.direction_id}"`,
      );
    }
  });

  return errors;
}

function validateLocationTypes(
  records: Record<string, string>[],
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    if (!isValidLocationType(record.location_type ?? '0')) {
      errors.push(
        `stops: Row ${index + 1}: invalid location_type "${record.location_type}"`,
      );
    }
  });

  return errors;
}

function validateRouteTypes(
  records: Record<string, string>[],
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    if (!isValidRouteType(record.route_type ?? '')) {
      errors.push(
        `routes: Row ${index + 1}: invalid route_type "${record.route_type}"`,
      );
    }
  });

  return errors;
}