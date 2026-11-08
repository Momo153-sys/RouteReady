
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetTransitGraphCache } from './transit-graph';
import { searchJourney } from './journey.service';

const mocks = vi.hoisted(() => ({
  edges: [] as Array<{
    routeId: string;
    routeName: string;
    fromStopId: string;
    toStopId: string;
  }>,
  walkingEdges: [] as Array<{
    fromStopId: string;
    toStopId: string;
    distanceMeters: number;
    durationMinutes: number;
  }>,
  stops: {} as Record<string, { id: string; name: string }>,
}));

vi.mock('../../database/dexie', () => {
  const connections = {
    toArray: async () => [...mocks.edges],
  };

  const walkingConnections = {
    toArray: async () => [...mocks.walkingEdges],
  };

  const stopTable = {
    toArray: async () => Object.values(mocks.stops),
    get: async (id: string) => mocks.stops[id],
  };

  const osmStops = {
    toArray: async () => [],
  };

  const osmRoutes = {
    toArray: async () => [],
  };

  return {
    getDatabase: () => ({
      connections,
      walkingEdges: walkingConnections,
      stops: stopTable,
      osmStops,
      osmRoutes,
      transaction: async (
        _mode: string,
        _tables: unknown[],
        callback: () => Promise<unknown>
      ) => callback(),
    }),
  };
});

vi.mock('../../repositories/journey.repository', () => ({
  getJourneyStops: vi.fn(async () => []),
}));

const addEdge = (
  routeId: string,
  routeName: string,
  fromStopId: string,
  toStopId: string
) => {
  mocks.edges.push({
    routeId,
    routeName,
    fromStopId,
    toStopId,
  });
};

const addWalkingEdge = (
  fromStopId: string,
  toStopId: string,
  distanceMeters = 100,
  durationMinutes = 2
) => {
  mocks.walkingEdges.push({
    fromStopId,
    toStopId,
    distanceMeters,
    durationMinutes,
  });
};

describe('searchJourney', () => {
  beforeEach(() => {
    resetTransitGraphCache();

    mocks.edges = [];
    mocks.walkingEdges = [];

    mocks.stops = {
      A: { id: 'A', name: 'Stop A' },
      B: { id: 'B', name: 'Stop B' },
      C: { id: 'C', name: 'Stop C' },
      D: { id: 'D', name: 'Stop D' },
      E: { id: 'E', name: 'Stop E' },
      F: { id: 'F', name: 'Stop F' },
    };
  });

  it('finds a direct connection', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-1', 'Bus 34', 'B', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].journey.transfers).toBe(0);
    expect(results[0].journey.legs).toHaveLength(1);

    const leg = results[0].journey.legs[0];

    expect(leg.type).toBe('transit');

    if (leg.type === 'transit') {
      expect(leg.routeId).toBe('route-1');
      expect(leg.fromStopId).toBe('A');
      expect(leg.toStopId).toBe('D');
    }
  });

  it('combines consecutive edges on the same route', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-1', 'Bus 34', 'B', 'C');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'C',
    });

    expect(results).toHaveLength(1);
    expect(results[0].journey.legs).toHaveLength(1);

    const leg = results[0].journey.legs[0];

    expect(leg.type).toBe('transit');

    if (leg.type === 'transit') {
      expect(leg.fromStopId).toBe('A');
      expect(leg.toStopId).toBe('C');
    }

    expect(results[0].journey.transfers).toBe(0);
  });

  it('finds a journey requiring one transfer', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-2', 'Metro M2', 'B', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    const journey = results.find(
      result => result.journey.transfers === 1
    );

    expect(journey).toBeDefined();
    expect(journey?.journey.legs).toHaveLength(2);

    const firstLeg = journey!.journey.legs[0];
    const secondLeg = journey!.journey.legs[1];

    expect(firstLeg.type).toBe('transit');
    expect(secondLeg.type).toBe('transit');

    if (firstLeg.type === 'transit' && secondLeg.type === 'transit') {
      expect(firstLeg.routeId).toBe('route-1');
      expect(secondLeg.routeId).toBe('route-2');
    }
  });

  it('finds direct connections before transfer connections', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-2', 'Metro M2', 'B', 'D');
    addEdge('route-3', 'Bus 99', 'A', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].journey.transfers).toBe(0);
  });

  it('does not count a transfer when changing GTFS trips on the same route', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-1', 'Bus 34', 'B', 'C');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'C',
    });

    expect(results).toHaveLength(1);
    expect(results[0].journey.transfers).toBe(0);
    expect(results[0].journey.legs).toHaveLength(1);
  });

  it('does not revisit stops within a journey', async () => {
    addEdge('route-1', 'Bus 10', 'A', 'B');
    addEdge('route-2', 'Bus 20', 'B', 'A');
    addEdge('route-3', 'Bus 30', 'B', 'C');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'C',
    });

    expect(results).toHaveLength(1);

    const visitedStops = [
      results[0].journey.originStopId,
      ...results[0].journey.legs.map(leg => leg.toStopId),
    ];

    expect(new Set(visitedStops).size).toBe(visitedStops.length);
  });

  it('returns an empty array when no connection exists', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(0);
  });

  it('returns an empty journey when origin equals destination', async () => {
    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'A',
    });

    expect(results).toHaveLength(1);
    expect(results[0].journey.transfers).toBe(0);
    expect(results[0].journey.legs).toHaveLength(0);
  });

  it('finds a journey using a walking connection', async () => {
    addWalkingEdge('A', 'B', 250, 4);
    addEdge('route-1', 'Metro M2', 'B', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results.length).toBeGreaterThan(0);

    const journey = results[0].journey;

    expect(journey.legs).toHaveLength(2);
    expect(journey.transfers).toBe(0);
    expect(journey.legs[0].type).toBe('walking');
    expect(journey.legs[1].type).toBe('transit');

    const walkingLeg = journey.legs[0];

    if (walkingLeg.type === 'walking') {
      expect(walkingLeg.distanceMeters).toBe(250);
      expect(walkingLeg.durationMinutes).toBe(4);
    }
  });

  it('counts a route change after walking as one transfer', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addWalkingEdge('B', 'C', 200, 3);
    addEdge('route-2', 'Metro M2', 'C', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    const journey = results.find(
      result => result.journey.transfers === 1
    );

    expect(journey).toBeDefined();
    expect(journey?.journey.legs).toHaveLength(3);

    expect(journey?.journey.legs.map(leg => leg.type)).toEqual([
      'transit',
      'walking',
      'transit',
    ]);
  });

  it('does not count walking as a transfer when continuing on the same route', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addWalkingEdge('B', 'C', 150, 2);
    addEdge('route-1', 'Bus 34', 'C', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    const journey = results.find(
      result => result.journey.transfers === 0
    );

    expect(journey).toBeDefined();
    expect(journey?.journey.legs.map(leg => leg.type)).toEqual([
      'transit',
      'walking',
      'transit',
    ]);
  });

  it('supports journeys requiring more than two transfers', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'B');
    addEdge('route-2', 'Metro M1', 'B', 'C');
    addEdge('route-3', 'Metro M2', 'C', 'E');
    addEdge('route-4', 'Bus 99', 'E', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].journey.transfers).toBe(3);
    expect(results[0].journey.legs).toHaveLength(4);
  });

  it('returns no more than five journeys', async () => {
    addEdge('route-1', 'Bus 1', 'A', 'D');
    addEdge('route-2', 'Bus 2', 'A', 'D');
    addEdge('route-3', 'Bus 3', 'A', 'D');
    addEdge('route-4', 'Bus 4', 'A', 'D');
    addEdge('route-5', 'Bus 5', 'A', 'D');
    addEdge('route-6', 'Bus 6', 'A', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(5);

    expect(
      results.every(result => result.journey.transfers === 0)
    ).toBe(true);
  });

  it('does not include departure or arrival times in journey legs', async () => {
    addEdge('route-1', 'Bus 34', 'A', 'D');

    const results = await searchJourney({
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);

    expect('departureTime' in results[0].journey.legs[0]).toBe(false);
    expect('arrivalTime' in results[0].journey.legs[0]).toBe(false);
  });
});
