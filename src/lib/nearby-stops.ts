import { getCurrentLocation } from './location';
import {
  getNearbyStops,
  type NearbyStop,
} from '../repositories/stop.repository';

export async function findNearbyStops(
  radiusKm = 1
): Promise<NearbyStop[]> {
  const location = await getCurrentLocation();

  return getNearbyStops(
    location.latitude,
    location.longitude,
    radiusKm
  );
}