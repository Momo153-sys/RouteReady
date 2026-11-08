
import { describe, it, expect } from 'vitest';
import {
  parseGtfsFiles,
  validateGtfsFiles,
  mapValidatedGtfsFiles,
  getGtfsImportErrors,
  canImportGtfs,
  validateGtfsRelationships,
  findDuplicateIds,
  findDuplicateStopTimeSequences,
} from './importer';

describe('parseGtfsFiles', () => {
  it('parses all six GTFS files', () => {
    const files = {
      agency: [
        'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
        '1,IETT,http://www.iett.istanbul,Europe/Istanbul,TR',
      ].join('\n'),

      stops: [
        'stop_id;stop_code;stop_name;stop_desc;stop_lat;stop_lon;location_type;',
        '292235;100001;RIFAT ILGAZ CADDESİ;direction: AVCILAR;410.191.700.005.564;286.843.529.999.755;0;',
      ].join('\n'),

      routes: [
        'route_id,agency_id,route_short_name,route_long_name,route_type,route_desc,route_code',
        '1,1,1,KADIKÖY - KİRAZLITEPE,3,,1_D_D0',
      ].join('\n'),

      calendar: [
        'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
        '0,WEEKDAYS,1,1,1,1,1,0,0,20260316,20261231',
      ].join('\n'),

      trips: [
        'trip_id,route_id,service_id,trip_headsign,direction_id',
        '446025067,1,6,KİRAZLITEPE,1',
      ].join('\n'),

      stopTimes: [
        'trip_id,stop_id,stop_sequence,arrival_time,departure_time,timepoint',
        '446025067,510964,1,06:40:00,06:40:00,1',
      ].join('\n'),
    };

    const result = parseGtfsFiles(files);

    expect(result.agency.data).toHaveLength(1);
    expect(result.stops.data).toHaveLength(1);
    expect(result.routes.data).toHaveLength(1);
    expect(result.calendar.data).toHaveLength(1);
    expect(result.trips.data).toHaveLength(1);
    expect(result.stopTimes.data).toHaveLength(1);

    expect(result.agency.errors).toHaveLength(0);
    expect(result.stops.errors).toHaveLength(0);
    expect(result.routes.errors).toHaveLength(0);
    expect(result.calendar.errors).toHaveLength(0);
    expect(result.trips.errors).toHaveLength(0);
    expect(result.stopTimes.errors).toHaveLength(0);
  });


it('validates required fields across all GTFS files', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul,TR',
    ].join('\n'),

    stops: [
      'stop_id;stop_code;stop_name;stop_desc;stop_lat;stop_lon;location_type;',
      '292235;100001;RIFAT ILGAZ CADDESİ;direction: AVCILAR;410.191.700.005.564;286.843.529.999.755;0;',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type,route_desc,route_code',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3,,1_D_D0',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '0,WEEKDAYS,1,1,1,1,1,0,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id,trip_headsign,direction_id',
      '446025067,1,6,KİRAZLITEPE,1',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence,arrival_time,departure_time,timepoint',
      '446025067,510964,1,06:40:00,06:40:00,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validated.agency.validRecords).toHaveLength(1);
  expect(validated.stops.validRecords).toHaveLength(1);
  expect(validated.routes.validRecords).toHaveLength(1);
  expect(validated.calendar.validRecords).toHaveLength(1);
  expect(validated.trips.validRecords).toHaveLength(1);
  expect(validated.stopTimes.validRecords).toHaveLength(1);

  expect(validated.stops.errors).toHaveLength(0);
  expect(validated.routes.errors).toHaveLength(0);
});



it('rejects records with missing required fields', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul,TR',
    ].join('\n'),

    stops: [
      'stop_id;stop_code;stop_name;stop_desc;stop_lat;stop_lon;location_type;',
      '292235;100001;RIFAT ILGAZ CADDESİ;direction: AVCILAR;410.191.700.005.564;286.843.529.999.755;0;',
      '292236;100002;;direction: BOĞAZKÖY;410.190.470.005.563;286.846.599.999.755;0;',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type,route_desc,route_code',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3,,1_D_D0',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '0,WEEKDAYS,1,1,1,1,1,0,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id,trip_headsign,direction_id',
      '446025067,1,6,KİRAZLITEPE,1',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence,arrival_time,departure_time,timepoint',
      '446025067,510964,1,06:40:00,06:40:00,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validated.stops.validRecords).toHaveLength(1);
  expect(validated.stops.errors).toHaveLength(1);
  expect(validated.stops.errors[0]).toContain('stop_name');
});


it('maps validated GTFS records into application models', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul,TR',
    ].join('\n'),

    stops: [
      'stop_id;stop_code;stop_name;stop_desc;stop_lat;stop_lon;location_type;',
      '292235;100001;RIFAT ILGAZ CADDESİ;direction: AVCILAR;410.191.700.005.564;286.843.529.999.755;0;',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type,route_desc,route_code',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3,,1_D_D0',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id,trip_headsign,direction_id',
      '446025067,1,6,KİRAZLITEPE,1',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence,arrival_time,departure_time,timepoint',
      '446025067,292235,1,06:40:00,06:40:00,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const mapped = mapValidatedGtfsFiles(validated);

  expect(mapped.agencies[0].name).toBe('IETT');
  expect(mapped.stops[0].id).toBe('292235');
  expect(mapped.routes[0].routeType).toBe('bus');
  expect(mapped.calendars[0].saturday).toBe(true);
  expect(mapped.trips[0].id).toBe('446025067');
  expect(mapped.stopTimes[0].arrivalTime).toBe('06:40:00');
});

it('preserves CSV parser errors in the validation result', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validated.parserErrors.agency).toEqual([]);
  expect(validated.parserErrors.stops).toEqual([]);
  expect(validated.parserErrors.routes).toEqual([]);
});

it('combines parser and validation errors into one report', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
  'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
  '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(errors).toHaveLength(2);

expect(errors.some((error) => error.includes('stops:'))).toBe(true);
expect(errors.some((error) => error.includes('stop_name'))).toBe(true);

expect(errors.some((error) => error.includes('stop_id'))).toBe(true);
});


it('rejects calendar records with invalid weekday flags', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,2,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid wednesday'))).toBe(true);
});

it('blocks import when validation errors exist', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(canImportGtfs(validated)).toBe(false);
});

it('accepts records with valid relationships', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validateGtfsRelationships(validated)).toEqual([]);
});

it('detects references to records that do not exist', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,999,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,999,999',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '999999,999999,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = validateGtfsRelationships(validated);

  expect(errors).toHaveLength(5);
  expect(errors.some((error) => error.includes('agency_id'))).toBe(true);
  expect(errors.some((error) => error.includes('route_id'))).toBe(true);
  expect(errors.some((error) => error.includes('service_id'))).toBe(true);
  expect(errors.some((error) => error.includes('trip_id'))).toBe(true);
  expect(errors.some((error) => error.includes('stop_id'))).toBe(true);
});

it('blocks import when dataset relationships are invalid', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,999,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(getGtfsImportErrors(validated).length).toBeGreaterThan(0);
  expect(canImportGtfs(validated)).toBe(false);
});


it('detects duplicate IDs without reporting them more than once', () => {
  const records = [
    { stop_id: '100001', stop_name: 'STOP A' },
    { stop_id: '100002', stop_name: 'STOP B' },
    { stop_id: '100001', stop_name: 'STOP C' },
    { stop_id: '100001', stop_name: 'STOP D' },
    { stop_id: '100003', stop_name: 'STOP E' },
  ];

  expect(findDuplicateIds(records, 'stop_id')).toEqual(['100001']);
});

it('returns an empty array when there are no duplicate IDs', () => {
  const records = [
    { route_id: '1', route_name: 'Route A' },
    { route_id: '2', route_name: 'Route B' },
  ];

  expect(findDuplicateIds(records, 'route_id')).toEqual([]);
});

it('blocks import when duplicate IDs exist', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;STOP A;410.191.700.005.564;286.843.529.999.755',
      '292235;STOP B;410.190.470.005.563;286.846.599.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validated.duplicateErrors.stops).toEqual(['292235']);
  expect(canImportGtfs(validated)).toBe(false);
});

it('detects duplicate stop sequences within the same trip', () => {
  const records = [
    { trip_id: '446025067', stop_sequence: '1' },
    { trip_id: '446025067', stop_sequence: '2' },
    { trip_id: '446025067', stop_sequence: '1' },
    { trip_id: '446025071', stop_sequence: '1' },
  ];

  expect(findDuplicateStopTimeSequences(records)).toEqual([
    '446025067:1',
  ]);
});

it('allows the same stop sequence in different trips', () => {
  const records = [
    { trip_id: '446025067', stop_sequence: '1' },
    { trip_id: '446025071', stop_sequence: '1' },
  ];

  expect(findDuplicateStopTimeSequences(records)).toEqual([]);
});

it('blocks import when duplicate stop-time sequences exist', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;STOP A;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(validated.duplicateErrors.stopTimes).toEqual([
    '446025067:1',
  ]);

  expect(canImportGtfs(validated)).toBe(false);
});

it('detects invalid service calendar dates', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;STOP A;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20260230,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(validated.calendarValueErrors).toHaveLength(1);
  expect(errors.some((error) => error.includes('invalid start_date'))).toBe(true);
  expect(canImportGtfs(validated)).toBe(false);
});

it('detects service calendars with reversed date ranges', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;STOP A;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,start_date,end_date',
      '6,SATURDAY,20261231,20260316',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);

  expect(
    validated.calendarValueErrors.some((error) =>
      error.includes('start_date is after end_date')
    )
  ).toBe(true);

  expect(canImportGtfs(validated)).toBe(false);
});


it('rejects stop-time records with invalid stop sequences', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,0',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid stop_sequence'))).toBe(true);
});


it('rejects stop-time records with invalid timepoint values', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence,timepoint',
      '446025067,292235,1,2',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid timepoint'))).toBe(true);
});

it('rejects trip records with invalid direction IDs', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id,direction_id',
      '446025067,1,6,2',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid direction_id'))).toBe(true);
});

it('rejects stop records with invalid location types', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon;location_type',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755;5',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,3',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid location_type'))).toBe(true);
});

it('rejects route records with unsupported route types', () => {
  const files = {
    agency: [
      'agency_id,agency_name,agency_url,agency_timezone',
      '1,IETT,http://www.iett.istanbul,Europe/Istanbul',
    ].join('\n'),

    stops: [
      'stop_id;stop_name;stop_lat;stop_lon',
      '292235;RIFAT ILGAZ CADDESİ;410.191.700.005.564;286.843.529.999.755',
    ].join('\n'),

    routes: [
      'route_id,agency_id,route_short_name,route_long_name,route_type',
      '1,1,1,KADIKÖY - KİRAZLITEPE,5',
    ].join('\n'),

    calendar: [
      'service_id,service_name,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      '6,SATURDAY,0,0,0,0,0,1,0,20260316,20261231',
    ].join('\n'),

    trips: [
      'trip_id,route_id,service_id',
      '446025067,1,6',
    ].join('\n'),

    stopTimes: [
      'trip_id,stop_id,stop_sequence',
      '446025067,292235,1',
    ].join('\n'),
  };

  const parsed = parseGtfsFiles(files);
  const validated = validateGtfsFiles(parsed);
  const errors = getGtfsImportErrors(validated);

  expect(canImportGtfs(validated)).toBe(false);
  expect(errors.some((error) => error.includes('invalid route_type'))).toBe(true);
});

});

