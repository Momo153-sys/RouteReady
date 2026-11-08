export interface GtfsRelationshipData {
  agencies: Record<string, string>[];
  routes: Record<string, string>[];
  calendars: Record<string, string>[];
  trips: Record<string, string>[];
  stops: Record<string, string>[];
}

export interface RelationshipValidationResult {
  valid: boolean;
  errors: string[];
}

function findDuplicates(
  records: Record<string, string>[],
  field: string,
  dataset: string
): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  records.forEach((record, index) => {
    const value = record[field];

    if (!value) {
      errors.push(`${dataset} row ${index + 1}: missing ${field}.`);
      return;
    }

    if (seen.has(value)) {
      errors.push(`${dataset}: duplicate ${field} "${value}".`);
      return;
    }

    seen.add(value);
  });

  return errors;
}

function validateReference(
  records: Record<string, string>[],
  field: string,
  validIds: Set<string>,
  dataset: string
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    const value = record[field];

    if (!value || !validIds.has(value)) {
      errors.push(
        `${dataset} row ${index + 1}: ${field} "${value}" does not exist.`
      );
    }
  });

  return errors;
}

export function validateGtfsRelationships(
  data: GtfsRelationshipData
): RelationshipValidationResult {
  const errors: string[] = [];

  // Check primary identifiers and duplicates.
  errors.push(
    ...findDuplicates(data.agencies, 'agency_id', 'Agencies'),
    ...findDuplicates(data.routes, 'route_id', 'Routes'),
    ...findDuplicates(data.calendars, 'service_id', 'Calendars'),
    ...findDuplicates(data.trips, 'trip_id', 'Trips'),
    ...findDuplicates(data.stops, 'stop_id', 'Stops')
  );

  // Build identifier sets.
  const agencyIds = new Set(
    data.agencies.map((record) => record.agency_id)
  );

  const routeIds = new Set(
    data.routes.map((record) => record.route_id)
  );

  const serviceIds = new Set(
    data.calendars.map((record) => record.service_id)
  );

  // Check foreign-key relationships.
  errors.push(
    ...validateReference(
      data.routes,
      'agency_id',
      agencyIds,
      'Routes'
    ),
    ...validateReference(
      data.trips,
      'route_id',
      routeIds,
      'Trips'
    ),
    ...validateReference(
      data.trips,
      'service_id',
      serviceIds,
      'Trips'
    )
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}