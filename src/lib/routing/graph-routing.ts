
import type {
  TransitGraph,
  GraphEdgeAttributes,
} from './transit-graph';

import type {
  Journey,
  JourneyLeg,
} from './connection-scan';

export interface GraphJourneySearchRequest {
  originStopId: string;
  destinationStopId: string;
  maximumTransfers?: number;
  maximumResults?: number;
}

interface SearchTransition {
  fromStopId: string;
  toStopId: string;
  attributes: GraphEdgeAttributes;
}

interface SearchState {
  currentStopId: string;
  transfers: number;
  lastTransitRouteId: string | undefined;
  walkingDistance: number;
  walkingDuration: number;
  stopCount: number;
  previous: SearchState | null;
  transition: SearchTransition | null;
}

const DEFAULT_MAXIMUM_TRANSFERS = 3;
const DEFAULT_MAXIMUM_RESULTS = 5;

const MAXIMUM_STOPS_PER_JOURNEY = 80;
const MAXIMUM_WALKING_DISTANCE_METERS = 1500;

class MinHeap<T> {
  private items: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }


  get size(): number {
    return this.items.length;
  }

  push(value: T): void {
    this.items.push(value);

    let index = this.items.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);

      if (this.compare(this.items[parent], value) <= 0) {
        break;
      }

      this.items[index] = this.items[parent];
      index = parent;
    }

    this.items[index] = value;
  }

  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const first = this.items[0];
    const last = this.items.pop();

    if (last !== undefined && this.items.length > 0) {
      let index = 0;

      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;

        if (left >= this.items.length) {
          break;
        }

        let smallest = left;

        if (
          right < this.items.length &&
          this.compare(this.items[right], this.items[left]) < 0
        ) {
          smallest = right;
        }

        if (this.compare(last, this.items[smallest]) <= 0) {
          break;
        }

        this.items[index] = this.items[smallest];
        index = smallest;
      }

      this.items[index] = last;
    }

    return first;
  }
}

function compareStates(
  a: SearchState,
  b: SearchState,
): number {
  return (
    a.transfers - b.transfers ||
    a.walkingDistance - b.walkingDistance ||
    a.walkingDuration - b.walkingDuration ||
    a.stopCount - b.stopCount
  );
}

function getStateKey(state: SearchState): string {
  return JSON.stringify([
    state.currentStopId,
    state.lastTransitRouteId ?? null,
    state.transfers,
  ]);
}

function buildJourney(
  graph: TransitGraph,
  finalState: SearchState,
  originStopId: string,
  destinationStopId: string,
): Journey {
  const transitions: SearchTransition[] = [];

  let current: SearchState | null = finalState;

  while (current?.transition) {
    transitions.push(current.transition);
    current = current.previous;
  }

  transitions.reverse();

  const legs: JourneyLeg[] = [];

  for (const transition of transitions) {
    const {
      fromStopId,
      toStopId,
      attributes,
    } = transition;

    const fromStopName = graph.getNodeAttribute(
      fromStopId,
      'label',
    ) as string;

    const toStopName = graph.getNodeAttribute(
      toStopId,
      'label',
    ) as string;

    const previousLeg = legs[legs.length - 1];

    if (attributes.type === 'walking') {
      if (previousLeg?.type === 'walking') {
        legs[legs.length - 1] = {
          ...previousLeg,
          toStopId,
          toStopName,
          distanceMeters:
            previousLeg.distanceMeters + attributes.distanceMeters,
          durationMinutes:
            previousLeg.durationMinutes + attributes.durationMinutes,
        };
      } else {
        legs.push({
          type: 'walking',
          fromStopId,
          fromStopName,
          toStopId,
          toStopName,
          distanceMeters: attributes.distanceMeters,
          durationMinutes: attributes.durationMinutes,
        });
      }
    } else {
      if (
        previousLeg?.type === 'transit' &&
        previousLeg.routeId === attributes.routeId
      ) {
        legs[legs.length - 1] = {
          ...previousLeg,
          toStopId,
          toStopName,
        };
      } else {
        legs.push({
          type: 'transit',
          routeId: attributes.routeId,
          routeName: attributes.routeName,
          fromStopId,
          fromStopName,
          toStopId,
          toStopName,
        });
      }
    }
  }

  return {
    originStopId,
    destinationStopId,
    transfers: finalState.transfers,
    legs,
  };
}


function hasVisitedStop(
  state: SearchState,
  stopId: string,
): boolean {
  let current: SearchState | null = state;

  while (current !== null) {
    if (current.currentStopId === stopId) {
      return true;
    }

    current = current.previous;
  }

  return false;
}

export function searchGraphJourneys(
  graph: TransitGraph,
  request: GraphJourneySearchRequest,
): Journey[] {
  const {
    originStopId,
    destinationStopId,
    maximumTransfers = DEFAULT_MAXIMUM_TRANSFERS,
    maximumResults = DEFAULT_MAXIMUM_RESULTS,
  } = request;

  if (
    !Number.isInteger(maximumTransfers) ||
    maximumTransfers < 0 ||
    !Number.isInteger(maximumResults) ||
    maximumResults <= 0
  ) {
    return [];
  }

  if (
    !graph.hasNode(originStopId) ||
    !graph.hasNode(destinationStopId)
  ) {
    return [];
  }

  if (originStopId === destinationStopId) {
    return [{
      originStopId,
      destinationStopId,
      transfers: 0,
      legs: [],
    }];
  }

  const initialState: SearchState = {
    currentStopId: originStopId,
    transfers: 0,
    lastTransitRouteId: undefined,
    walkingDistance: 0,
    walkingDuration: 0,
    stopCount: 1,
    previous: null,
    transition: null,
  };

  const queue = new MinHeap<SearchState>(compareStates);
  const bestStates = new Map<string, SearchState>();

  queue.push(initialState);
  bestStates.set(getStateKey(initialState), initialState);

  const journeys: Journey[] = [];

  while (queue.size > 0 && journeys.length < maximumResults) {
    const state = queue.pop();

    if (!state) {
      break;
    }

    // Ignore outdated queue entries.
    if (bestStates.get(getStateKey(state)) !== state) {
      continue;
    }

    if (state.currentStopId === destinationStopId) {
      journeys.push(
        buildJourney(
          graph,
          state,
          originStopId,
          destinationStopId,
        ),
      );

      continue;
    }

    if (state.stopCount >= MAXIMUM_STOPS_PER_JOURNEY) {
      continue;
    }

    for (const edge of graph.outEdges(state.currentStopId)) {
      const nextStopId = graph.target(edge);
      if (hasVisitedStop(state, nextStopId)) {
  continue;
}

      const attributes = graph.getEdgeAttributes(
        edge,
      ) as GraphEdgeAttributes;

      let nextTransfers = state.transfers;
      let nextLastTransitRouteId = state.lastTransitRouteId;

      let nextWalkingDistance = state.walkingDistance;
      let nextWalkingDuration = state.walkingDuration;

      if (attributes.type === 'walking') {
        nextWalkingDistance += attributes.distanceMeters;
        nextWalkingDuration += attributes.durationMinutes;

        if (
          nextWalkingDistance > MAXIMUM_WALKING_DISTANCE_METERS
        ) {
          continue;
        }

        // Preserve the last transit route across walking.
      } else {
        const continuingSameRoute =
          state.lastTransitRouteId === attributes.routeId;

        if (
          state.lastTransitRouteId !== undefined &&
          !continuingSameRoute
        ) {
          nextTransfers++;
        }

        if (nextTransfers > maximumTransfers) {
          continue;
        }

        nextLastTransitRouteId = attributes.routeId;
      }

      const nextState: SearchState = {
        currentStopId: nextStopId,
        transfers: nextTransfers,
        lastTransitRouteId: nextLastTransitRouteId,
        walkingDistance: nextWalkingDistance,
        walkingDuration: nextWalkingDuration,
        stopCount: state.stopCount + 1,
        previous: state,
        transition: {
          fromStopId: state.currentStopId,
          toStopId: nextStopId,
          attributes,
        },
      };

      const key = getStateKey(nextState);
      const existing = bestStates.get(key);

      // Keep only the better path to an equivalent routing state.
      if (
        existing &&
        compareStates(nextState, existing) >= 0
      ) {
        continue;
      }

      bestStates.set(key, nextState);
      queue.push(nextState);
    }
  }

  return journeys;
}
