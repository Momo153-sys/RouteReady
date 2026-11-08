
import { describe, it, expect } from 'vitest';
import { 
    validateRequiredFields, 
    isValidGtfsDate, 
    isValidGtfsDateRange, 
    isValidGtfsWeekdayFlag, 
    isValidStopSequence,
    isValidTimepoint,
    isValidDirectionId,
    isValidLocationType,
    isValidRouteType,
    isValidGtfsTime,
 } from './validation';

describe('validateRequiredFields', () => {
  const records = [
    {
      stop_id: '292235',
      stop_name: 'RIFAT ILGAZ CADDESİ',
      stop_lat: '41.010454',
      stop_lon: '28.684352',
    },
    {
      stop_id: '292236',
      stop_name: '',
      stop_lat: '41.010675',
      stop_lon: '28.688751',
    },
    {
      stop_id: '',
      stop_name: 'UZUNYAYLA',
      stop_lat: '41.010675',
      stop_lon: '28.688751',
    },
  ];

  it('keeps records with all required fields', () => {
    const result = validateRequiredFields(records, [
      'stop_id',
      'stop_name',
      'stop_lat',
      'stop_lon',
    ]);

    expect(result.validRecords).toHaveLength(1);
    expect(result.validRecords[0].stop_id).toBe('292235');
  });

  it('reports records with missing fields', () => {
    const result = validateRequiredFields(records, [
      'stop_id',
      'stop_name',
      'stop_lat',
      'stop_lon',
    ]);

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('stop_name');
    expect(result.errors[1]).toContain('stop_id');
  });

  it('returns no errors when all records are valid', () => {
    const validRecords = [records[0]];

    const result = validateRequiredFields(validRecords, [
      'stop_id',
      'stop_name',
      'stop_lat',
      'stop_lon',
    ]);

    expect(result.errors).toHaveLength(0);
    expect(result.validRecords).toHaveLength(1);
  });

  it('handles an empty dataset', () => {
    const result = validateRequiredFields([], [
      'stop_id',
      'stop_name',
    ]);

    expect(result.validRecords).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid GTFS dates', () => {
  expect(isValidGtfsDate('20261231')).toBe(true);
  expect(isValidGtfsDate('20260228')).toBe(true);
  expect(isValidGtfsDate('20240229')).toBe(true);
});

it('rejects impossible calendar dates', () => {
  expect(isValidGtfsDate('20260230')).toBe(false);
  expect(isValidGtfsDate('20261301')).toBe(false);
  expect(isValidGtfsDate('20260431')).toBe(false);
});

it('rejects dates with an invalid format', () => {
  expect(isValidGtfsDate('2026-12-31')).toBe(false);
  expect(isValidGtfsDate('2026123')).toBe(false);
  expect(isValidGtfsDate('')).toBe(false);
});

it('accepts valid chronological date ranges', () => {
  expect(
    isValidGtfsDateRange('20260316', '20261231')
  ).toBe(true);

  expect(
    isValidGtfsDateRange('20261231', '20261231')
  ).toBe(true);
});

it('rejects date ranges where the start date is after the end date', () => {
  expect(
    isValidGtfsDateRange('20261231', '20260316')
  ).toBe(false);
});

it('rejects date ranges containing invalid dates', () => {
  expect(
    isValidGtfsDateRange('20260230', '20261231')
  ).toBe(false);

  expect(
    isValidGtfsDateRange('20260316', '20261301')
  ).toBe(false);
});

it('accepts valid GTFS weekday flags', () => {
  expect(isValidGtfsWeekdayFlag('0')).toBe(true);
  expect(isValidGtfsWeekdayFlag('1')).toBe(true);
});

it('rejects invalid GTFS weekday flags', () => {
  expect(isValidGtfsWeekdayFlag('2')).toBe(false);
  expect(isValidGtfsWeekdayFlag('yes')).toBe(false);
  expect(isValidGtfsWeekdayFlag('')).toBe(false);
});
});

describe('isValidStopSequence', () => {
  it('accepts positive integers', () => {
    expect(isValidStopSequence('1')).toBe(true);
    expect(isValidStopSequence('25')).toBe(true);
    expect(isValidStopSequence('100')).toBe(true);
  });

  it('rejects invalid stop sequences', () => {
    expect(isValidStopSequence('0')).toBe(false);
    expect(isValidStopSequence('-1')).toBe(false);
    expect(isValidStopSequence('1.5')).toBe(false);
    expect(isValidStopSequence('abc')).toBe(false);
    expect(isValidStopSequence('')).toBe(false);
  });
});

describe('isValidTimepoint', () => {
  it('accepts valid timepoint values', () => {
    expect(isValidTimepoint('0')).toBe(true);
    expect(isValidTimepoint('1')).toBe(true);
  });

  it('rejects invalid timepoint values', () => {
    expect(isValidTimepoint('2')).toBe(false);
    expect(isValidTimepoint('yes')).toBe(false);
    expect(isValidTimepoint('')).toBe(false);
  });
});

describe('isValidDirectionId', () => {
  it('accepts 0 and 1', () => {
    expect(isValidDirectionId('0')).toBe(true);
    expect(isValidDirectionId('1')).toBe(true);
  });

  it('accepts an empty value because direction_id is optional', () => {
    expect(isValidDirectionId('')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidDirectionId('2')).toBe(false);
    expect(isValidDirectionId('-1')).toBe(false);
    expect(isValidDirectionId('abc')).toBe(false);
  });
});

describe('isValidLocationType', () => {
  it('accepts all valid GTFS location types', () => {
    expect(isValidLocationType('0')).toBe(true);
    expect(isValidLocationType('1')).toBe(true);
    expect(isValidLocationType('2')).toBe(true);
    expect(isValidLocationType('3')).toBe(true);
    expect(isValidLocationType('4')).toBe(true);
  });

  it('rejects invalid location types', () => {
    expect(isValidLocationType('5')).toBe(false);
    expect(isValidLocationType('-1')).toBe(false);
    expect(isValidLocationType('abc')).toBe(false);
    expect(isValidLocationType('')).toBe(false);
  });
});

describe('isValidRouteType', () => {
  it('accepts supported GTFS route types', () => {
    expect(isValidRouteType('0')).toBe(true);
    expect(isValidRouteType('1')).toBe(true);
    expect(isValidRouteType('2')).toBe(true);
    expect(isValidRouteType('3')).toBe(true);
    expect(isValidRouteType('4')).toBe(true);
  });

  it('rejects unsupported route types', () => {
    expect(isValidRouteType('5')).toBe(false);
    expect(isValidRouteType('-1')).toBe(false);
    expect(isValidRouteType('abc')).toBe(false);
    expect(isValidRouteType('')).toBe(false);
  });
});

describe('isValidGtfsTime', () => {
  it.each([
    '00:00:00',
    '08:30:00',
    '8:30:00',
    '23:59:59',
    '25:15:00',
    '100:05:30',
  ])('accepts valid GTFS time: %s', (value) => {
    expect(isValidGtfsTime(value)).toBe(true);
  });

  it.each([
    '',
    '08:5:00',
    '08:30',
    '08:60:00',
    '08:30:60',
    'abc',
    '-01:00:00',
  ])('rejects invalid GTFS time: %s', (value) => {
    expect(isValidGtfsTime(value)).toBe(false);
  });
});