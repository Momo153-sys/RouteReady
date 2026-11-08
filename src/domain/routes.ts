export type RouteType =
  | 'bus'
  | 'metro'
  | 'tram'
  | 'ferry'
  | 'metrobüs'
  | 'funicular'
  | 'train';

export interface Route {
  id: string;
  agencyId: string;
  shortName: string;
  longName: string;
  routeType: RouteType;
  description?: string;
  code?: string;
  color?: string;
}

export interface Trip {
  id: string;
  routeId: string;
  serviceId: string;
  headsign?: string;
  directionId?: number;
}