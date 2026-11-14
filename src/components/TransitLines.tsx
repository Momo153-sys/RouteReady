
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Stop } from '../domain/stops';
import type { Route, Trip } from '../domain/routes';
import type { OSMStop } from '../lib/import/osm-parser';

import { getDatabase } from '../database/dexie';
import {
  getAllRoutes,
  getTripsByRouteId,
} from '../repositories/route.repository';
import {
  getStopTimesByTripId,
} from '../repositories/stop-time.repository';

type LineCategory =
  | 'bus'
  | 'metrobus'
  | 'metro'
  | 'tram'
  | 'train'
  | 'ferry'
  | 'funicular'
  | 'light_rail';

type CategoryFilter = 'all' | LineCategory;

interface TransitLine {
  id: string;
  source: 'gtfs' | 'osm';
  category: LineCategory;
  code: string;
  name: string;
  description?: string;
}

interface Station {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

interface LinePattern {
  id: string;
  label: string;
  headsign?: string;
  stops: Station[];
}

const CATEGORY_LABELS: Record<LineCategory, string> = {
  bus: 'Bus',
  metrobus: 'Metrobus',
  metro: 'Metro',
  tram: 'Tram',
  train: 'Train',
  ferry: 'Ferry',
  funicular: 'Funicular',
  light_rail: 'Light rail',
};

const CATEGORY_ICONS: Record<LineCategory, string> = {
  bus: '🚌',
  metrobus: '🚍',
  metro: '🚇',
  tram: '🚊',
  train: '🚆',
  ferry: '⛴',
  funicular: '🚠',
  light_rail: '🚈',
};

const CATEGORY_ORDER: LineCategory[] = [
  'bus',
  'metrobus',
  'metro',
  'tram',
  'light_rail',
  'train',
  'ferry',
  'funicular',
];

const FILTERS: {
  value: CategoryFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All lines' },
  ...CATEGORY_ORDER.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
  })),
];

const PAGE_SIZE = 100;

function getOsmCategory(type: string): LineCategory | null {
  const categories: Record<string, LineCategory> = {
    subway: 'metro',
    tram: 'tram',
    light_rail: 'light_rail',
    funicular: 'funicular',
    ferry: 'ferry',
    train: 'train',
    bus: 'metrobus',
  };

  return categories[type] ?? null;
}

function getGtfsCategory(route: Route): LineCategory {
  if (route.routeType === 'metrobüs') {
    return 'metrobus';
  }

  return route.routeType;
}

function normalizeCode(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getLineDeduplicationKey(line: TransitLine): string {
  return `${line.category}:${normalizeCode(line.code || line.name)}`;
}

async function loadTransitLines(): Promise<TransitLine[]> {
  const db = getDatabase();

  const [gtfsRoutes, osmRoutes] = await Promise.all([
    getAllRoutes(),
    db.osmRoutes.toArray(),
  ]);

  const lines: TransitLine[] = [];
  const seen = new Set<string>();

  // Load OSM lines first.
  for (const route of osmRoutes) {
    const category = getOsmCategory(route.type);

    if (!category) continue;

    const line: TransitLine = {
      id: route.id,
      source: 'osm',
      category,
      code: route.ref || route.name,
      name: route.name,
    };

    const key = getLineDeduplicationKey(line);

    if (seen.has(key)) continue;

    seen.add(key);
    lines.push(line);
  }

  // Load GTFS routes.
  for (const route of gtfsRoutes) {
    const category = getGtfsCategory(route);

    const line: TransitLine = {
      id: route.id,
      source: 'gtfs',
      category,
      code: route.shortName || route.code || route.id,
      name: route.longName || route.shortName || route.id,
      description: route.description,
    };

    const key = getLineDeduplicationKey(line);

    // Do not merge ordinary bus routes merely because
    // they share the same short name.
    if (category !== 'bus' && seen.has(key)) {
      continue;
    }

    if (category !== 'bus') {
      seen.add(key);
    }

    lines.push(line);
  }

  return lines.sort((a, b) => {
    const categoryDifference =
      CATEGORY_ORDER.indexOf(a.category) -
      CATEGORY_ORDER.indexOf(b.category);

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return a.code.localeCompare(b.code, 'tr', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function mapOsmStation(stop: OSMStop): Station {
  return {
    id: stop.id,
    name: stop.name,
    latitude: stop.latitude,
    longitude: stop.longitude,
  };
}

function mapGtfsStation(stop: Stop): Station {
  return {
    id: stop.id,
    name: stop.name,
    latitude: stop.latitude,
    longitude: stop.longitude,
  };
}

async function loadOsmPatterns(
  line: TransitLine,
): Promise<LinePattern[]> {
  const db = getDatabase();
  const route = await db.osmRoutes.get(line.id);

  if (!route) {
    throw new Error(
      'The selected OSM route could not be found.',
    );
  }

  const records = await db.osmStops.bulkGet(route.stopIds);

  const stopsById = new Map(
    records
      .filter((stop): stop is OSMStop => stop !== undefined)
      .map((stop) => [stop.id, stop]),
  );

  // Reconstruct the exact relation order.
  const orderedStops = route.stopIds
    .map((id) => stopsById.get(id))
    .filter((stop): stop is OSMStop => stop !== undefined)
    .map(mapOsmStation);

  return [
    {
      id: route.id,
      label: 'Mapped route',
      stops: orderedStops,
    },
  ];
}

async function loadGtfsPatterns(
  line: TransitLine,
): Promise<LinePattern[]> {
  const db = getDatabase();

  const trips = await getTripsByRouteId(line.id);

  if (trips.length === 0) return [];

  // Group trips by direction and destination.
  const groupedTrips = new Map<string, Trip>();

  for (const trip of trips) {
    const direction = trip.directionId ?? 'unknown';
    const headsign = trip.headsign?.trim() ?? '';

    const key = `${direction}|${headsign.toLocaleLowerCase()}`;

    if (!groupedTrips.has(key)) {
      groupedTrips.set(key, trip);
    }
  }

  const patterns = await Promise.all(
    [...groupedTrips.values()].map(async (trip, index) => {
      const stopTimes = await getStopTimesByTripId(trip.id);

      const stopRecords = await db.stops.bulkGet(
        stopTimes.map((record) => record.stopId),
      );

      // Keep the stop-time sequence.
      const orderedStops = stopRecords
        .filter((stop): stop is Stop => stop !== undefined)
        .map(mapGtfsStation);

      const label =
        trip.headsign?.trim() ||
        (trip.directionId !== undefined
          ? `Direction ${trip.directionId + 1}`
          : `Route pattern ${index + 1}`);

      return {
        id: trip.id,
        label,
        headsign: trip.headsign,
        stops: orderedStops,
      };
    }),
  );

  return patterns.filter(
    (pattern) => pattern.stops.length > 0,
  );
}

function TransitLines() {
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [activeFilter, setActiveFilter] =
    useState<CategoryFilter>('all');

  const [visibleCount, setVisibleCount] =
    useState(PAGE_SIZE);

  const [selectedLine, setSelectedLine] =
    useState<TransitLine | null>(null);

  const [patterns, setPatterns] = useState<LinePattern[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState('');

  const detailRequestId = useRef(0);

  // Load the local transit catalogue.
  useEffect(() => {
    let cancelled = false;

    loadTransitLines()
      .then((result) => {
        if (!cancelled) {
          setLines(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load transit lines.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter and search the catalogue.
  const filteredLines = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLocaleLowerCase();

    return lines.filter((line) => {
      if (
        activeFilter !== 'all' &&
        line.category !== activeFilter
      ) {
        return false;
      }

      if (!query) return true;

      return (
        line.code.toLocaleLowerCase().includes(query) ||
        line.name.toLocaleLowerCase().includes(query) ||
        CATEGORY_LABELS[line.category]
          .toLocaleLowerCase()
          .includes(query)
      );
    });
  }, [lines, searchQuery, activeFilter]);

  // Open a line and load its station sequence.
  async function handleSelectLine(line: TransitLine) {
    const requestId = ++detailRequestId.current;

    setSelectedLine(line);
    setPatterns([]);
    setDetailError('');
    setIsLoadingDetails(true);

    try {
      const result =
        line.source === 'osm'
          ? await loadOsmPatterns(line)
          : await loadGtfsPatterns(line);

      if (requestId === detailRequestId.current) {
        setPatterns(result);
      }
    } catch (err) {
      if (requestId === detailRequestId.current) {
        setDetailError(
          err instanceof Error
            ? err.message
            : 'Unable to load this route.',
        );
      }
    } finally {
      if (requestId === detailRequestId.current) {
        setIsLoadingDetails(false);
      }
    }
  }

  function handleBackToCatalogue() {
    detailRequestId.current++;

    setSelectedLine(null);
    setPatterns([]);
    setDetailError('');
    setIsLoadingDetails(false);
  }

  // Reset pagination directly when the user changes search.
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  // Reset pagination directly when the user changes category.
  function handleFilterChange(value: CategoryFilter) {
    setActiveFilter(value);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleLines = filteredLines.slice(0, visibleCount);

  return (
    <section className="transit-lines-page">
      <header className="settings-header">
        <span className="welcome-eyebrow">
          ISTANBUL PUBLIC TRANSPORT
        </span>

        <h1 className="saved-places-title">
          {selectedLine ? selectedLine.code : 'Transit Lines'}
        </h1>

        <p className="saved-places-description">
          {selectedLine
            ? selectedLine.name
            : 'Explore Istanbul buses, metrobus, metro, trains, trams and ferries.'}
        </p>
      </header>

      {selectedLine ? (
        <div className="transit-line-details">
          <button
            type="button"
            className="secondary-button transit-back-button"
            onClick={handleBackToCatalogue}
          >
            ← All lines
          </button>

          <div className="transit-line-detail-header">
            <div className="transit-line-detail-icon">
              {CATEGORY_ICONS[selectedLine.category]}
            </div>

            <div>
              <span className="transit-line-category">
                {CATEGORY_LABELS[selectedLine.category]}
              </span>

              <h2>{selectedLine.name}</h2>

              <p>Line {selectedLine.code}</p>
            </div>
          </div>

          {selectedLine.description && (
            <p className="transit-line-description">
              {selectedLine.description}
            </p>
          )}

          <div className="transit-pattern-section">
            <h3>Route and stations</h3>

            {isLoadingDetails && (
              <p className="status-message">
                Loading station sequence...
              </p>
            )}

            {detailError && (
              <p className="error-message" role="alert">
                {detailError}
              </p>
            )}

            {!isLoadingDetails &&
              !detailError &&
              patterns.length === 0 && (
                <p className="status-message">
                  No station sequence is available for this line.
                </p>
              )}

            {patterns.map((pattern) => {
              const firstStop = pattern.stops[0];
              const lastStop =
                pattern.stops[pattern.stops.length - 1];

              return (
                <article
                  className="transit-pattern-card"
                  key={pattern.id}
                >
                  <div className="transit-pattern-heading">
                    <div>
                      <h4>{pattern.label}</h4>

                      <span>
                        {pattern.stops.length} stations
                      </span>
                    </div>
                  </div>

                  {firstStop && lastStop && (
                    <div className="transit-route-endpoints">
                      <div>
                        <span>FIRST STATION</span>
                        <strong>{firstStop.name}</strong>
                      </div>

                      <span aria-hidden="true">→</span>

                      <div>
                        <span>LAST STATION</span>
                        <strong>{lastStop.name}</strong>
                      </div>
                    </div>
                  )}

                  <ol className="transit-station-list">
                    {pattern.stops.map((stop, index) => (
                      <li key={`${stop.id}-${index}`}>
                        <span className="transit-station-number">
                          {index + 1}
                        </span>

                        <span className="transit-station-name">
                          {stop.name}
                        </span>

                        {index === 0 && (
                          <span className="transit-endpoint-tag">
                            Start
                          </span>
                        )}

                        {index === pattern.stops.length - 1 && (
                          <span className="transit-endpoint-tag destination">
                            End
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}

            {selectedLine.source === 'gtfs' &&
              patterns.length > 0 && (
                <p className="transit-data-note">
                  Station sequences represent sample trips for
                  each direction and destination. Individual
                  departures may follow different stop patterns.
                </p>
              )}
          </div>
        </div>
      ) : (
        <>
          <div className="transit-lines-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              placeholder="Search line number or name..."
              value={searchQuery}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
              aria-label="Search transit lines"
            />
          </div>

          <div
            className="transit-line-filters"
            aria-label="Filter by transport type"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`transit-filter-button ${
                  activeFilter === filter.value ? 'active' : ''
                }`}
                onClick={() => handleFilterChange(filter.value)}
                aria-pressed={activeFilter === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="transit-lines-results-header">
            <h2>Available lines</h2>

            <span>
              {filteredLines.length.toLocaleString()} lines
            </span>
          </div>

          {isLoading && (
            <div className="status-message">
              Loading local transit lines...
            </div>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {!isLoading &&
            !error &&
            filteredLines.length === 0 && (
              <div className="status-message">
                No transit lines found. Try another search or filter.
              </div>
            )}

          {!isLoading && filteredLines.length > 0 && (
            <>
              <div className="transit-lines-list">
                {visibleLines.map((line) => (
                  <button
                    key={`${line.source}-${line.id}`}
                    type="button"
                    className="transit-line-item"
                    onClick={() => void handleSelectLine(line)}
                  >
                    <span
                      className={`transit-line-code ${line.category}`}
                    >
                      {line.code}
                    </span>

                    <span className="transit-line-item-info">
                      <strong>{line.name}</strong>

                      <small>
                        {CATEGORY_LABELS[line.category]}
                      </small>
                    </span>

                    <span
                      className="transit-line-arrow"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                ))}
              </div>

              {filteredLines.length > visibleLines.length && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    width: '100%',
                    marginTop: '18px',
                  }}
                  onClick={() =>
                    setVisibleCount((current) =>
                      Math.min(
                        current + PAGE_SIZE,
                        filteredLines.length,
                      ),
                    )
                  }
                >
                  Show more (
                  {(
                    filteredLines.length - visibleLines.length
                  ).toLocaleString()}{' '}
                  remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

export default TransitLines;
