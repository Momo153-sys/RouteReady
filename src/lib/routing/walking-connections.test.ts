
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stops: [] as Array<{
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
    locationType: number;
  }>,
  osmStops: [] as Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>,
  walkingEdges: [] as Array<{
    fromStopId: string;
    toStopId: string;
    distanceMeters: number;
    durationMinutes: number;
  }>,
}));

vi.mock('../../database/dexie', () => ({
  getDatabase: () => ({
    stops: {
      toArray: async () => [...mocks.stops],
    },
    osmStops: {
      toArray: async () => [...mocks.osmStops],
    },
    walkingEdges: {
      clear: async () => {
        mocks.walkingEdges = [];
      },
      bulkPut: async (edges: typeof mocks.walkingEdges) => {
        mocks.walkingEdges.push(...edges);
      },
    },
    transaction: async (
      _mode: string,
      _tables: unknown[],
      callback: () => Promise<unknown>
    ) => callback(),
  }),
}));

import { generateWalkingConnections } from './walking-connections';

describe('generateWalkingConnections', () => {
  beforeEach(() => {
    mocks.stops = [];
    mocks.osmStops = [];
    mocks.walkingEdges = [];
  });

  it('creates connections between stops within 300 metres', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Stop B',
        latitude: 41.001,
        longitude: 29,
        locationType: 0,
      },
    ];

    const count = await generateWalkingConnections();

    expect(count).toBe(2);
    expect(mocks.walkingEdges).toHaveLength(2);
  });

  it('does not connect stops more than 300 metres apart', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Stop B',
        latitude: 41.005,
        longitude: 29,
        locationType: 0,
      },
    ];

    const count = await generateWalkingConnections();

    expect(count).toBe(0);
    expect(mocks.walkingEdges).toHaveLength(0);
  });

  it('creates walking connections in both directions', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Stop B',
        latitude: 41.001,
        longitude: 29,
        locationType: 0,
      },
    ];

    await generateWalkingConnections();

    expect(mocks.walkingEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStopId: 'A',
          toStopId: 'B',
        }),
        expect.objectContaining({
          fromStopId: 'B',
          toStopId: 'A',
        }),
      ])
    );
  });

  it('ignores stops without valid coordinates', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Stop B',
        locationType: 0,
      },
      {
        id: 'C',
        name: 'Stop C',
        latitude: Number.NaN,
        longitude: 29,
        locationType: 0,
      },
    ];

    const count = await generateWalkingConnections();

    expect(count).toBe(0);
  });

  it('preserves connections between distinct stops at identical coordinates', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Bus Stop',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Metro Stop',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
    ];

    const count = await generateWalkingConnections();

    expect(count).toBe(2);
    expect(mocks.walkingEdges).toHaveLength(2);

    expect(
      mocks.walkingEdges.every(edge => edge.durationMinutes === 1)
    ).toBe(true);
  });

  it('calculates a minimum one-minute walking duration', async () => {
    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
      {
        id: 'B',
        name: 'Stop B',
        latitude: 41.0001,
        longitude: 29,
        locationType: 0,
      },
    ];

    await generateWalkingConnections();

    expect(mocks.walkingEdges).toHaveLength(2);
    expect(mocks.walkingEdges[0].durationMinutes).toBe(1);
  });

  it('clears previous walking connections before saving new ones', async () => {
    mocks.walkingEdges = [
      {
        fromStopId: 'OLD',
        toStopId: 'STOP',
        distanceMeters: 100,
        durationMinutes: 2,
      },
    ];

    mocks.stops = [
      {
        id: 'A',
        name: 'Stop A',
        latitude: 41,
        longitude: 29,
        locationType: 0,
      },
    ];

    await generateWalkingConnections();

    expect(mocks.walkingEdges).toHaveLength(0);
  });
});
