
export interface TransitJourneyLeg {
  type: 'transit';
  routeId: string;
  routeName: string;
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
}

export interface WalkingJourneyLeg {
  type: 'walking';
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  distanceMeters: number;
  durationMinutes: number;
}

export type JourneyLeg = TransitJourneyLeg | WalkingJourneyLeg;

export interface Journey {
  originStopId: string;
  destinationStopId: string;
  transfers: number;
  legs: JourneyLeg[];
}

export interface RouteSearchOptions {
  originStopId: string;
  destinationStopId: string;
  maximumTransfers?: number;
  maximumResults?: number;
}
