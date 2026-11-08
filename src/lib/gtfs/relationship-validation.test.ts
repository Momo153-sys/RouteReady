import { describe, it, expect } from 'vitest';
import { validateGtfsRelationships } from './relationship-validation';

const validData = {
  agencies: [
    { agency_id: 'AGENCY_1' },
  ],
  routes: [
    { route_id: 'ROUTE_1', agency_id: 'AGENCY_1' },
  ],
  calendars: [
    { service_id: 'SERVICE_1' },
  ],
  trips: [
    {
      trip_id: 'TRIP_1',
      route_id: 'ROUTE_1',
      service_id: 'SERVICE_1',
    },
  ],
  stops: [
    { stop_id: 'STOP_1' },
  ],
};

describe('GTFS relationship validation', () => {
  it('accepts valid dataset relationships', () => {
    const result = validateGtfsRelationships(validData);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects routes with unknown agencies', () => {
    const data = {
      ...validData,
      routes: [
        { route_id: 'ROUTE_1', agency_id: 'UNKNOWN' },
      ],
    };

    const result = validateGtfsRelationships(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Routes row 1: agency_id "UNKNOWN" does not exist.'
    );
  });

  it('rejects trips with unknown routes', () => {
    const data = {
      ...validData,
      trips: [
        {
          trip_id: 'TRIP_1',
          route_id: 'UNKNOWN',
          service_id: 'SERVICE_1',
        },
      ],
    };

    const result = validateGtfsRelationships(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Trips row 1: route_id "UNKNOWN" does not exist.'
    );
  });

  it('rejects trips with unknown services', () => {
    const data = {
      ...validData,
      trips: [
        {
          trip_id: 'TRIP_1',
          route_id: 'ROUTE_1',
          service_id: 'UNKNOWN',
        },
      ],
    };

    const result = validateGtfsRelationships(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Trips row 1: service_id "UNKNOWN" does not exist.'
    );
  });

  it('rejects duplicate identifiers', () => {
    const data = {
      ...validData,
      stops: [
        { stop_id: 'STOP_1' },
        { stop_id: 'STOP_1' },
      ],
    };

    const result = validateGtfsRelationships(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Stops: duplicate stop_id "STOP_1".'
    );
  });

  it('rejects missing identifiers', () => {
    const data = {
      ...validData,
      trips: [
        {
          trip_id: '',
          route_id: 'ROUTE_1',
          service_id: 'SERVICE_1',
        },
      ],
    };

    const result = validateGtfsRelationships(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Trips row 1: missing trip_id.'
    );
  });
});