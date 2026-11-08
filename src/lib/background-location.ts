
import {
  watchUserLocation,
  stopWatchingLocation,
  type UserLocation,
} from './location';

interface BackgroundLocationOptions {
  onLocationUpdate: (location: UserLocation) => void;
  onError?: (error: Error) => void;
}

/**
 * PWA location monitoring.
 * Tracking continues while RouteReady is active.
 * Background tracking is not supported reliably by iOS Safari.
 */
export async function watchBackgroundLocation(
  options: BackgroundLocationOptions
): Promise<string> {
  return watchUserLocation(
    options.onLocationUpdate,
    options.onError,
  );
}

export async function stopBackgroundLocation(
  watcherId: string
): Promise<void> {
  await stopWatchingLocation(watcherId);
}
