
import { describe, it, expect } from 'vitest';
import {
  mapAgencyRecord,
  mapStopRecord,
  mapRouteRecord,
  mapServiceCalendarRecord,
  mapTripRecord,
  mapStopTimeRecord,
} from './mappers';

describe('mapAgencyRecord', () => {
  it('maps a GTFS agency record into an Agency object', () => {
    const record = {
      _id: '1',
      agency_id: '1',
      agency_name: 'IETT',
      agency_url: 'http://www.iett.istanbul',
      agency_timezone: 'Europe/Istanbul',
      agency_lang: 'TR',
    };

    const result = mapAgencyRecord(record);

    expect(result).toEqual({
      id: '1',
      name: 'IETT',
      url: 'http://www.iett.istanbul',
      timezone: 'Europe/Istanbul',
      language: 'TR',
    });

    expect(result).not.toHaveProperty('_id');
  });

  it('handles an empty optional language field', () => {
    const record = {
      agency_id: '1',
      agency_name: 'IETT',
      agency_url: 'http://www.iett.istanbul',
      agency_timezone: 'Europe/Istanbul',
      agency_lang: '',
    };

    const result = mapAgencyRecord(record);

    expect(result.language).toBeUndefined();
  });
});


describe('mapStopRecord', () => {
  it('maps a GTFS stop record into a Stop object', () => {
    const record = {
      stop_id: '292235',
      stop_code: '100001',
      stop_name: 'RIFAT ILGAZ CADDESİ',
      stop_desc: 'direction: AVCILAR',
      stop_lat: '410.191.700.005.564',
      stop_lon: '286.843.529.999.755',
      location_type: '0',
    };

    const result = mapStopRecord(record);

    expect(result).toEqual({
      id: '292235',
      code: '100001',
      name: 'RIFAT ILGAZ CADDESİ',
      description: 'direction: AVCILAR',
      latitude: 41.0191700005564,
      longitude: 28.6843529999755,
      locationType: 0,
    });
  });

  it('handles empty optional fields', () => {
    const record = {
      stop_id: '292236',
      stop_code: '',
      stop_name: 'UZUNYAYLA',
      stop_desc: '',
      stop_lat: '41.010675',
      stop_lon: '28.688751',
      location_type: '',
    };

    const result = mapStopRecord(record);

    expect(result.code).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.locationType).toBe(0);
  });
});


describe('mapRouteRecord', () => {
  const baseRecord = {
    route_id: '1',
    agency_id: '1',
    route_short_name: '1',
    route_long_name: 'KADIKÖY - KİRAZLITEPE',
    route_desc: '',
    route_code: '1_D_D0',
  };

  it('maps GTFS route type 3 to bus', () => {
    const result = mapRouteRecord({
      ...baseRecord,
      route_type: '3',
    });

    expect(result).toEqual({
      id: '1',
      agencyId: '1',
      shortName: '1',
      longName: 'KADIKÖY - KİRAZLITEPE',
      routeType: 'bus',
      description: undefined,
      code: '1_D_D0',
    });
  });

  it('maps supported GTFS transport types', () => {
    const expectedTypes = {
      '0': 'tram',
      '1': 'metro',
      '2': 'train',
      '3': 'bus',
      '4': 'ferry',
    };

    for (const [gtfsType, expectedType] of Object.entries(expectedTypes)) {
      const result = mapRouteRecord({
        ...baseRecord,
        route_type: gtfsType,
      });

      expect(result.routeType).toBe(expectedType);
    }
  });

  it('rejects unsupported GTFS route types', () => {
    expect(() =>
      mapRouteRecord({
        ...baseRecord,
        route_type: '99',
      })
    ).toThrow('Unsupported GTFS route type: 99');
  });
});



describe('mapServiceCalendarRecord', () => {
  it('maps GTFS weekday flags and service dates correctly', () => {
    const record = {
      service_id: '0',
      service_name: 'WEEKDAYS',
      monday: '1',
      tuesday: '1',
      wednesday: '1',
      thursday: '1',
      friday: '1',
      saturday: '0',
      sunday: '0',
      start_date: '20260316',
      end_date: '20261231',
    };

    const result = mapServiceCalendarRecord(record);

    expect(result).toEqual({
      serviceId: '0',
      serviceName: 'WEEKDAYS',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      startDate: '20260316',
      endDate: '20261231',
    });
  });

  it('maps a Saturday-only service correctly', () => {
    const record = {
      service_id: '6',
      service_name: 'SATURDAY',
      monday: '0',
      tuesday: '0',
      wednesday: '0',
      thursday: '0',
      friday: '0',
      saturday: '1',
      sunday: '0',
      start_date: '20260316',
      end_date: '20261231',
    };

    const result = mapServiceCalendarRecord(record);

    expect(result.saturday).toBe(true);
    expect(result.sunday).toBe(false);
    expect(result.monday).toBe(false);
  });
});


describe('mapTripRecord', () => {
  it('maps a GTFS trip record correctly', () => {
    const record = {
      trip_id: '446025067',
      route_id: '1',
      service_id: '6',
      trip_headsign: 'KİRAZLITEPE',
      direction_id: '1',
    };

    const result = mapTripRecord(record);

    expect(result).toEqual({
      id: '446025067',
      routeId: '1',
      serviceId: '6',
      headsign: 'KİRAZLITEPE',
      directionId: 1,
    });
  });

  it('handles empty optional trip fields', () => {
    const record = {
      trip_id: '446025071',
      route_id: '2',
      service_id: '6',
      trip_headsign: '',
      direction_id: '',
    };

    const result = mapTripRecord(record);

    expect(result.headsign).toBeUndefined();
    expect(result.directionId).toBeUndefined();
  });
});



describe('mapStopTimeRecord', () => {
  it('maps a GTFS stop time record correctly', () => {
    const record = {
      trip_id: '446025067',
      stop_id: '510964',
      stop_sequence: '1',
      arrival_time: '06:40:00',
      departure_time: '06:40:00',
      timepoint: '1',
    };

    const result = mapStopTimeRecord(record);

    expect(result).toEqual({
      tripId: '446025067',
      stopId: '510964',
      arrivalTime: '06:40:00',
      departureTime: '06:40:00',
      stopSequence: 1,
      timepoint: true,
    });
  });

  it('converts empty arrival and departure times to null', () => {
    const record = {
      trip_id: '446025067',
      stop_id: '510801',
      stop_sequence: '2',
      arrival_time: '',
      departure_time: '',
      timepoint: '0',
    };

    const result = mapStopTimeRecord(record);

    expect(result.arrivalTime).toBeNull();
    expect(result.departureTime).toBeNull();
    expect(result.timepoint).toBe(false);
  });

  it('preserves GTFS times beyond midnight', () => {
    const record = {
      trip_id: '446025067',
      stop_id: '510676',
      stop_sequence: '3',
      arrival_time: '25:30:00',
      departure_time: '25:30:00',
      timepoint: '1',
    };

    const result = mapStopTimeRecord(record);

    expect(result.arrivalTime).toBe('25:30:00');
    expect(result.departureTime).toBe('25:30:00');
  });

  it('preserves stops with missing coordinates', () => {
  const record = {
    stop_id: '5252467',
    stop_code: '291672',
    stop_name: 'MARMARA ÜNİVERSİTESİ ATATÜRK EĞİTİM FAKÜLTESİ',
    stop_desc: 'direction: SONDURAK',
    latitude: '',
    longitude: '',
    location_type: '0',
  };

  const result = mapStopRecord(record);

  expect(result).toEqual({
    id: '5252467',
    code: '291672',
    name: 'MARMARA ÜNİVERSİTESİ ATATÜRK EĞİTİM FAKÜLTESİ',
    description: 'direction: SONDURAK',
    latitude: undefined,
    longitude: undefined,
    locationType: 0,
  });
});
});
