
export interface JourneyLocation {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
}

export interface JourneyLeg {
  id: string;
  routeId: string;
  routeName: string;
  transportType: string;
  departureStop: JourneyLocation;
  arrivalStop: JourneyLocation;
  departureTime: string;
  arrivalTime: string;
}

export interface Journey {
  id: string;
  origin: JourneyLocation;
  destination: JourneyLocation;
  legs: JourneyLeg[];
  totalDurationMinutes: number;
  transferCount: number;
  createdAt: string;
}
