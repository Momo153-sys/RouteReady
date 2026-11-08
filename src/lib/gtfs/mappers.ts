
import type { Agency } from '../../domain/agencies';
import type { Stop } from '../../domain/stops';
import { normalizeCoordinate } from './coordinates';
import type { Route, Trip } from '../../domain/routes';
import type { ServiceCalendar } from '../../domain/services';
import type { StopTime } from '../../repositories/stop-time.repository';

export function mapAgencyRecord(
  record: Record<string, string>
): Agency {
  return {
    id: record.agency_id,
    name: record.agency_name,
    url: record.agency_url,
    timezone: record.agency_timezone,
    language: record.agency_lang || undefined,
  };
}


export function mapStopRecord(
  record: Record<string, string>
): Stop {
  const latitudeValue = record.latitude || record.stop_lat;
  const longitudeValue = record.longitude || record.stop_lon;

  return {
    id: record.stop_id,
    code: record.stop_code || undefined,
    name: record.stop_name,
    description: record.stop_desc || undefined,
    latitude: latitudeValue
      ? normalizeCoordinate(latitudeValue, 'latitude')
      : undefined,
    longitude: longitudeValue
      ? normalizeCoordinate(longitudeValue, 'longitude')
      : undefined,
    locationType: Number(record.location_type || 0),
  };
}

export function mapRouteRecord(
  record: Record<string, string>
): Route {
  const routeTypes: Record<string, Route['routeType']> = {
    '0': 'tram',
    '1': 'metro',
    '2': 'train',
    '3': 'bus',
    '4': 'ferry',
  };

  const routeType =
    routeTypes[record.route_type?.trim() ?? ''] ??
    (record.route_type?.trim() === '' ? 'bus' : undefined);

  if (!routeType) {
    throw new Error(
      `Unsupported GTFS route type: ${record.route_type}`
    );
  }

  return {
    id: record.route_id,
    agencyId: record.agency_id,
    shortName: record.route_short_name,
    longName: record.route_long_name,
    routeType,
    description: record.route_desc || undefined,
    code: record.route_code || undefined,
  };
}

export function mapServiceCalendarRecord(
  record: Record<string, string>
): ServiceCalendar {
  return {
    serviceId: record.service_id,
    serviceName: record.service_name,
    monday: record.monday === '1',
    tuesday: record.tuesday === '1',
    wednesday: record.wednesday === '1',
    thursday: record.thursday === '1',
    friday: record.friday === '1',
    saturday: record.saturday === '1',
    sunday: record.sunday === '1',
    startDate: record.start_date,
    endDate: record.end_date,
  };
}

export function mapTripRecord(
  record: Record<string, string>
): Trip {
  return {
    id: record.trip_id,
    routeId: record.route_id,
    serviceId: record.service_id,
    headsign: record.trip_headsign || undefined,
    directionId:
      record.direction_id === ''
        ? undefined
        : Number(record.direction_id),
  };
}


export function mapStopTimeRecord(
  record: Record<string, string>
): StopTime {
  return {
    tripId: record.trip_id,
    stopId: record.stop_id,
    arrivalTime: record.arrival_time || null,
    departureTime: record.departure_time || null,
    stopSequence: Number(record.stop_sequence),
    timepoint: record.timepoint !== '0',
  };
}
