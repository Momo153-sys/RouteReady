export type StopType =
  | 'bus'
  | 'metro'
  | 'tram'
  | 'ferry'
  | 'metrobüs'
  | 'funicular'
  | 'train';


export interface Stop {
  id: string;
  code?: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  locationType: number;
}
