
import { describe, expect, it } from 'vitest';
import { MultiDirectedGraph } from 'graphology';

import { searchGraphJourneys } from './graph-routing';

type TestEdge =
  | {
      type: 'transit';
      routeId: string;
      routeName: string;
      from: string;
      to: string;
    }
  | {
      type: 'walking';
      distanceMeters: number;
      durationMinutes: number;
      from: string;
      to: string;
    };

function createGraph(edges: TestEdge[]) {
  const graph = new MultiDirectedGraph();

  const stopIds = new Set(
    edges.flatMap(edge => [edge.from, edge.to])
  );

  for (const id of stopIds) {
    graph.addNode(id, { label: `Stop ${id}` });
  }

  for (const edge of edges) {
    if (edge.type === 'walking') {
      graph.addDirectedEdge(edge.from, edge.to, {
        type: 'walking',
        distanceMeters: edge.distanceMeters,
        durationMinutes: edge.durationMinutes,
      });
    } else {
      graph.addDirectedEdge(edge.from, edge.to, {
        type: 'transit',
        routeId: edge.routeId,
        routeName: edge.routeName,
      });
    }
  }

  return graph;
}

describe('searchGraphJourneys', () => {
  it('prioritizes direct journeys over journeys with transfers', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'B' },
      { type: 'transit', routeId: 'R2', routeName: 'Metro 2', from: 'B', to: 'D' },
      { type: 'transit', routeId: 'R3', routeName: 'Bus 3', from: 'A', to: 'D' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results[0].transfers).toBe(0);
    expect(results[0].legs[0]).toMatchObject({
      type: 'transit',
      routeId: 'R3',
    });
  });

  it('prioritizes fewer route segments when transfers are equal', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'D' },
      { type: 'transit', routeId: 'R2', routeName: 'Bus 2', from: 'A', to: 'B' },
      { type: 'transit', routeId: 'R2', routeName: 'Bus 2', from: 'B', to: 'C' },
      { type: 'transit', routeId: 'R2', routeName: 'Bus 2', from: 'C', to: 'D' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results[0].legs).toHaveLength(1);
    expect(results[0].legs[0]).toMatchObject({
      type: 'transit',
      routeId: 'R1',
    });
  });

  it('returns distinct journeys using different routes', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'D' },
      { type: 'transit', routeId: 'R2', routeName: 'Bus 2', from: 'A', to: 'D' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(2);
    expect(results.map(result => result.legs[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routeId: 'R1' }),
        expect.objectContaining({ routeId: 'R2' }),
      ])
    );
  });

  it('respects the maximum result limit', () => {
    const graph = createGraph(
      Array.from({ length: 8 }, (_, index) => ({
        type: 'transit' as const,
        routeId: `R${index}`,
        routeName: `Bus ${index}`,
        from: 'A',
        to: 'D',
      }))
    );

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
      maximumResults: 5,
    });

    expect(results).toHaveLength(5);
  });

  it('returns no journeys for an invalid stop', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'B' },
    ]);

    expect(
      searchGraphJourneys(graph, {
        originStopId: 'A',
        destinationStopId: 'UNKNOWN',
      })
    ).toEqual([]);
  });

  it('finds a journey using walking followed by transit', () => {
    const graph = createGraph([
      {
        type: 'walking',
        from: 'A',
        to: 'B',
        distanceMeters: 150,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Metro M1',
        from: 'B',
        to: 'D',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(0);
    expect(results[0].legs).toHaveLength(2);
    expect(results[0].legs[0]).toMatchObject({
      type: 'walking',
      fromStopId: 'A',
      toStopId: 'B',
      distanceMeters: 150,
      durationMinutes: 2,
    });
    expect(results[0].legs[1]).toMatchObject({
      type: 'transit',
      routeName: 'Metro M1',
    });
  });

  it('finds a journey using transit followed by walking', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'A',
        to: 'B',
      },
      {
        type: 'walking',
        from: 'B',
        to: 'D',
        distanceMeters: 200,
        durationMinutes: 3,
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(0);
    expect(results[0].legs).toHaveLength(2);
    expect(results[0].legs[1]).toMatchObject({
      type: 'walking',
      distanceMeters: 200,
    });
  });

  it('does not count walking as a public-transport transfer', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'A',
        to: 'B',
      },
      {
        type: 'walking',
        from: 'B',
        to: 'C',
        distanceMeters: 100,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R2',
        routeName: 'Metro M1',
        from: 'C',
        to: 'D',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(1);
    expect(results[0].legs).toHaveLength(3);
  });

  it('counts multiple transit route changes but not walking', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'A',
        to: 'B',
      },
      {
        type: 'walking',
        from: 'B',
        to: 'C',
        distanceMeters: 100,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R2',
        routeName: 'Metro M1',
        from: 'C',
        to: 'D',
      },
      {
        type: 'walking',
        from: 'D',
        to: 'E',
        distanceMeters: 100,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R3',
        routeName: 'Tram T1',
        from: 'E',
        to: 'F',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'F',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(2);
    expect(results[0].legs).toHaveLength(5);
  });

  it('merges consecutive edges on the same transit route', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'A',
        to: 'B',
      },
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'B',
        to: 'C',
      },
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'C',
        to: 'D',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].legs).toHaveLength(1);
    expect(results[0].legs[0]).toMatchObject({
      type: 'transit',
      fromStopId: 'A',
      toStopId: 'D',
    });
    expect(results[0].transfers).toBe(0);
  });

  it('does not merge transit segments separated by walking', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'A',
        to: 'B',
      },
      {
        type: 'walking',
        from: 'B',
        to: 'C',
        distanceMeters: 100,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 34',
        from: 'C',
        to: 'D',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toHaveLength(1);
    expect(results[0].legs).toHaveLength(3);
    expect(results[0].legs[0].type).toBe('transit');
    expect(results[0].legs[1].type).toBe('walking');
    expect(results[0].legs[2].type).toBe('transit');
    expect(results[0].transfers).toBe(0);
  });

  it('rejects journeys exceeding the maximum walking distance', () => {
    const graph = createGraph([
      {
        type: 'walking',
        from: 'A',
        to: 'B',
        distanceMeters: 1000,
        durationMinutes: 14,
      },
      {
        type: 'walking',
        from: 'B',
        to: 'D',
        distanceMeters: 600,
        durationMinutes: 8,
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results).toEqual([]);
  });

  it('prefers shorter walking journeys when transfers are equal', () => {
    const graph = createGraph([
      {
        type: 'walking',
        from: 'A',
        to: 'B',
        distanceMeters: 250,
        durationMinutes: 4,
      },
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Metro M1',
        from: 'B',
        to: 'D',
      },
      {
        type: 'walking',
        from: 'A',
        to: 'C',
        distanceMeters: 100,
        durationMinutes: 2,
      },
      {
        type: 'transit',
        routeId: 'R2',
        routeName: 'Metro M2',
        from: 'C',
        to: 'D',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
    });

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].legs[0]).toMatchObject({
      type: 'walking',
      distanceMeters: 100,
    });
  });

  it('does not revisit stops within a journey', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 10',
        from: 'A',
        to: 'B',
      },
      {
        type: 'transit',
        routeId: 'R2',
        routeName: 'Bus 20',
        from: 'B',
        to: 'A',
      },
      {
        type: 'transit',
        routeId: 'R3',
        routeName: 'Bus 30',
        from: 'B',
        to: 'C',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'C',
    });

    expect(results).toHaveLength(1);

    const visitedStops = [
      results[0].legs[0].fromStopId,
      ...results[0].legs.map(leg => leg.toStopId),
    ];

    expect(new Set(visitedStops).size).toBe(visitedStops.length);
  });

  it('returns an empty journey when origin equals destination', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 1',
        from: 'A',
        to: 'B',
      },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'A',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(0);
    expect(results[0].legs).toHaveLength(0);
  });

  it('returns no journeys when no connection exists', () => {
    const graph = createGraph([
      {
        type: 'transit',
        routeId: 'R1',
        routeName: 'Bus 1',
        from: 'A',
        to: 'B',
      },
    ]);

    expect(
      searchGraphJourneys(graph, {
        originStopId: 'A',
        destinationStopId: 'D',
      })
    ).toEqual([]);
  });

  it('finds the previously failing 1919.SOKAK to Cennet Mahallesi Metrobüs journey', () => {
    const graph = createGraph([
      { type: 'walking', from: '292450', to: '292268', distanceMeters: 100, durationMinutes: 2 },
      { type: 'walking', from: '292268', to: '292452', distanceMeters: 100, durationMinutes: 2 },
      { type: 'transit', routeId: '3817', routeName: 'ES1', from: '292452', to: '801750' },
      { type: 'transit', routeId: '3817', routeName: 'ES1', from: '801750', to: '292503' },
      { type: 'walking', from: '292503', to: 'osm:12772322404', distanceMeters: 100, durationMinutes: 2 },
      { type: 'transit', routeId: 'osm:18769051', routeName: '34B Beylikdüzü → Avcılar', from: 'osm:12772322404', to: 'osm:11663774831' },
      { type: 'transit', routeId: 'osm:18769051', routeName: '34B Beylikdüzü → Avcılar', from: 'osm:11663774831', to: 'osm:12772322405' },
      { type: 'transit', routeId: 'osm:18769051', routeName: '34B Beylikdüzü → Avcılar', from: 'osm:12772322405', to: 'osm:11663774829' },
      { type: 'transit', routeId: 'osm:18769051', routeName: '34B Beylikdüzü → Avcılar', from: 'osm:11663774829', to: 'osm:11663774828' },
      { type: 'transit', routeId: 'osm:18769051', routeName: '34B Beylikdüzü → Avcılar', from: 'osm:11663774828', to: 'osm:2279591969' },
      { type: 'transit', routeId: 'osm:7399563', routeName: '34AS Avcılar → Söğütlüçeşme', from: 'osm:2279591969', to: 'osm:11663774826' },
      { type: 'transit', routeId: 'osm:7399563', routeName: '34AS Avcılar → Söğütlüçeşme', from: 'osm:11663774826', to: 'osm:11663774825' },
      { type: 'transit', routeId: 'osm:7399563', routeName: '34AS Avcılar → Söğütlüçeşme', from: 'osm:11663774825', to: 'osm:11663774824' },
      { type: 'transit', routeId: 'osm:7399563', routeName: '34AS Avcılar → Söğütlüçeşme', from: 'osm:11663774824', to: 'osm:9164537140' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: '292450',
      destinationStopId: 'osm:9164537140',
      maximumTransfers: 3,
      maximumResults: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(2);
    expect(results[0].legs.map(leg =>
      leg.type === 'walking' ? 'walking' : leg.routeId
    )).toEqual([
      'walking',
      '3817',
      'walking',
      'osm:18769051',
      'osm:7399563',
    ]);
    expect(results[0].legs[0]).toMatchObject({
      type: 'walking',
      fromStopId: '292450',
      toStopId: '292452',
    });
    expect(results[0].legs[3]).toMatchObject({
      type: 'transit',
      fromStopId: 'osm:12772322404',
      toStopId: 'osm:2279591969',
    });
    expect(results[0].legs[4]).toMatchObject({
      type: 'transit',
      fromStopId: 'osm:2279591969',
      toStopId: 'osm:9164537140',
    });
  });

  it('enforces the requested maximum number of transfers', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'B' },
      { type: 'transit', routeId: 'R2', routeName: 'Metro 2', from: 'B', to: 'C' },
      { type: 'transit', routeId: 'R3', routeName: 'Tram 3', from: 'C', to: 'D' },
    ]);

    expect(searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
      maximumTransfers: 1,
    })).toEqual([]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'D',
      maximumTransfers: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(2);
  });

  it('preserves the last transit route across walking sections', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'B' },
      { type: 'walking', from: 'B', to: 'C', distanceMeters: 120, durationMinutes: 2 },
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'C', to: 'D' },
      { type: 'transit', routeId: 'R2', routeName: 'Metro 2', from: 'D', to: 'E' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'A',
      destinationStopId: 'E',
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(1);
    expect(results[0].legs.map(leg => leg.type)).toEqual([
      'transit', 'walking', 'transit', 'transit',
    ]);
    expect(results[0].legs[2]).toMatchObject({
      type: 'transit',
      routeId: 'R1',
      fromStopId: 'C',
      toStopId: 'D',
    });
    expect(results[0].legs[3]).toMatchObject({
      type: 'transit',
      routeId: 'R2',
      fromStopId: 'D',
      toStopId: 'E',
    });
  });

  it('respects directed transit edges and does not invent reverse journeys', () => {
    const graph = createGraph([
      { type: 'transit', routeId: 'R1', routeName: 'Bus 1', from: 'A', to: 'B' },
    ]);

    expect(searchGraphJourneys(graph, {
      originStopId: 'B',
      destinationStopId: 'A',
    })).toEqual([]);
  });

  it('finds a valid connection despite many unrelated dead-end branches', () => {
    const deadEndEdges: TestEdge[] = Array.from(
      { length: 200 },
      (_, index) => ({
        type: 'transit' as const,
        routeId: `DEAD_ROUTE_${index}`,

        routeName: `Dead-end route ${index}`,
        from: 'ORIGIN',
        to: `DEAD_END_${index}`,
      }),
    );

    const graph = createGraph([
      ...deadEndEdges,
      { type: 'transit', routeId: 'R1', routeName: 'Metro M1', from: 'ORIGIN', to: 'TRANSFER' },
      { type: 'transit', routeId: 'R2', routeName: 'Bus 2', from: 'TRANSFER', to: 'DESTINATION' },
    ]);

    const results = searchGraphJourneys(graph, {
      originStopId: 'ORIGIN',
      destinationStopId: 'DESTINATION',
      maximumTransfers: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0].transfers).toBe(1);
    expect(results[0].legs.map(leg =>
      leg.type === 'transit' ? leg.routeId : 'walking'
    )).toEqual(['R1', 'R2']);
  });
});
