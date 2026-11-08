
import { MultiDirectedGraph } from 'graphology';

import { getDatabase } from '../../database/dexie';
import type { TransitEdge } from '../../domain/transit-edge';
import type { WalkingEdge } from '../../domain/walking-edge';

export type TransitGraph = MultiDirectedGraph;

export interface TransitGraphStats {
  nodes: number;
  edges: number;
  routes: number;
  walkingEdges: number;
}

interface TransitGraphEdgeAttributes {
  type: 'transit';
  routeId: string;
  routeName: string;
}

interface WalkingGraphEdgeAttributes {
  type: 'walking';
  distanceMeters: number;
  durationMinutes: number;
}

export type GraphEdgeAttributes =
  | TransitGraphEdgeAttributes
  | WalkingGraphEdgeAttributes;

export async function buildTransitGraph(): Promise<TransitGraph> {
  const db = getDatabase();
  const graph: TransitGraph = new MultiDirectedGraph();

  await db.transaction(
    'r',
    [
      db.stops,
      db.connections,
      db.walkingEdges,
      db.osmStops,
      db.osmRoutes,
    ],
    async () => {
      const [
        stops,
        connections,
        walkingEdges,
        osmStops,
        osmRoutes,
      ] = await Promise.all([
        db.stops.toArray(),
        db.connections.toArray(),
        db.walkingEdges.toArray(),
        db.osmStops.toArray(),
        db.osmRoutes.toArray(),
      ]);

      // Add GTFS stops.
      for (const stop of stops) {
        if (!graph.hasNode(stop.id)) {
          graph.addNode(stop.id, {
            label: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            locationType: stop.locationType,
          });
        }
      }

      // Add OSM stops.
      for (const stop of osmStops) {
        if (!graph.hasNode(stop.id)) {
          graph.addNode(stop.id, {
            label: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            locationType: 0,
          });
        }
      }

      // Add GTFS transit connections.
      for (const connection of connections as TransitEdge[]) {
        if (
          !graph.hasNode(connection.fromStopId) ||
          !graph.hasNode(connection.toStopId)
        ) {
          continue;
        }

        graph.addDirectedEdgeWithKey(
          `transit:${connection.routeId}:${connection.fromStopId}:${connection.toStopId}`,
          connection.fromStopId,
          connection.toStopId,
          {
            type: 'transit',
            routeId: connection.routeId,
            routeName: connection.routeName,
          } satisfies TransitGraphEdgeAttributes,
        );
      }

      // Add OSM transit connections in their ordered route direction.
      for (const route of osmRoutes) {
        for (let i = 0; i < route.stopIds.length - 1; i++) {
          const fromStopId = route.stopIds[i];
          const toStopId = route.stopIds[i + 1];

          if (
            !graph.hasNode(fromStopId) ||
            !graph.hasNode(toStopId)
          ) {
            continue;
          }

          graph.addDirectedEdgeWithKey(
            `osm:${route.id}:${fromStopId}:${toStopId}`,
            fromStopId,
            toStopId,
            {
              type: 'transit',
              routeId: route.id,
              routeName: route.name,
            } satisfies TransitGraphEdgeAttributes,
          );
        }
      }

      // Add bidirectional walking connections.
      for (const connection of walkingEdges as WalkingEdge[]) {
        if (
          !graph.hasNode(connection.fromStopId) ||
          !graph.hasNode(connection.toStopId)
        ) {
          continue;
        }

        graph.addDirectedEdgeWithKey(
          `walking:${connection.fromStopId}:${connection.toStopId}`,
          connection.fromStopId,
          connection.toStopId,
          {
            type: 'walking',
            distanceMeters: connection.distanceMeters,
            durationMinutes: connection.durationMinutes,
          } satisfies WalkingGraphEdgeAttributes,
        );
      }
    },
  );

  return graph;
}

export function getTransitGraphStats(
  graph: TransitGraph,
): TransitGraphStats {
  const routes = new Set<string>();
  let walkingEdges = 0;

  graph.forEachEdge((_edge, attributes) => {
    const edge = attributes as GraphEdgeAttributes;

    if (edge.type === 'transit') {
      routes.add(edge.routeId);
    } else if (edge.type === 'walking') {
      walkingEdges++;
    }
  });

  return {
    nodes: graph.order,
    edges: graph.size,
    routes: routes.size,
    walkingEdges,
  };
}

let cachedTransitGraph: Promise<TransitGraph> | undefined;

export function getTransitGraph(): Promise<TransitGraph> {
  if (!cachedTransitGraph) {
    cachedTransitGraph = buildTransitGraph().catch((error) => {
      cachedTransitGraph = undefined;
      throw error;
    });
  }

  return cachedTransitGraph;
}

export function resetTransitGraphCache(): void {
  cachedTransitGraph = undefined;
}
