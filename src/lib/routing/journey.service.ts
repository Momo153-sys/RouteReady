
import { getJourneyStops } from '../../repositories/journey.repository';
import type { Stop } from '../../domain/stops';

import {
  getTransitGraph,
  getTransitGraphStats,
} from './transit-graph';
import { searchGraphJourneys } from './graph-routing';

import type { Journey } from './connection-scan';

export interface JourneySearchRequest {
  originStopId: string;
  destinationStopId: string;
  maximumTransfers?: number;
  maximumResults?: number;
}

export interface JourneySearchResult {
  journey: Journey;
  stops: Stop[];
}

export async function searchJourney(
  request: JourneySearchRequest
): Promise<JourneySearchResult[]> {
  console.info('[RouteReady] searchJourney called:', request);

  try {
    const graph = await getTransitGraph();

    console.info(
      '[RouteReady] Graph loaded:',
      getTransitGraphStats(graph)
    );

    const journeys = searchGraphJourneys(graph, request);

    console.info(
      '[RouteReady] Journeys found:',
      journeys.length
    );

    return Promise.all(
      journeys.map(async journey => ({
        journey,
        stops: await getJourneyStops(journey),
      }))
    );
  } catch (error) {
    console.error('[RouteReady] Journey search failed:', error);
    throw error;
  }
}
