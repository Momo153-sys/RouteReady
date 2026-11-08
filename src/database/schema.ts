
export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  timezone TEXT NOT NULL,
  language TEXT
);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_type INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  short_name TEXT NOT NULL,
  long_name TEXT NOT NULL,
  route_type TEXT NOT NULL,
  description TEXT,
  code TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS services (
  service_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  headsign TEXT,
  direction_id INTEGER,
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (service_id) REFERENCES services(service_id)
);

CREATE TABLE IF NOT EXISTS service_calendars (
  service_id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  monday INTEGER NOT NULL,
  tuesday INTEGER NOT NULL,
  wednesday INTEGER NOT NULL,
  thursday INTEGER NOT NULL,
  friday INTEGER NOT NULL,
  saturday INTEGER NOT NULL,
  sunday INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(service_id)
);

CREATE TABLE IF NOT EXISTS service_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  exception_date TEXT NOT NULL,
  exception_type INTEGER NOT NULL,
  UNIQUE (service_id, exception_date),
  FOREIGN KEY (service_id) REFERENCES services(service_id)
);

CREATE TABLE IF NOT EXISTS stop_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_sequence INTEGER NOT NULL,
  timepoint INTEGER NOT NULL DEFAULT 1,
  UNIQUE (trip_id, stop_sequence),
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (stop_id) REFERENCES stops(id)
);

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stop_times_trip
ON stop_times(trip_id, stop_sequence);

CREATE INDEX IF NOT EXISTS idx_stop_times_stop
ON stop_times(stop_id);

CREATE INDEX IF NOT EXISTS idx_trips_route
ON trips(route_id);

CREATE INDEX IF NOT EXISTS idx_routes_agency
ON routes(agency_id);
`;
