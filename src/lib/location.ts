
export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
};

function getBrowserGeolocation(): Geolocation {
  if (
    typeof navigator === 'undefined' ||
    !navigator.geolocation
  ) {
    throw new Error(
      'Location services are not supported by this browser.',
    );
  }

  if (
    typeof window !== 'undefined' &&
    !window.isSecureContext
  ) {
    throw new Error(
      'Location requires HTTPS. Open RouteReady using a secure connection.',
    );
  }

  return navigator.geolocation;
}

function mapPosition(position: GeolocationPosition): UserLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}

function mapLocationError(error: GeolocationPositionError): Error {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new Error(
        'Location permission was denied. Allow location access in your browser settings.',
      );

    case error.POSITION_UNAVAILABLE:
      return new Error(
        'Your current location is unavailable. Check your device location services.',
      );

    case error.TIMEOUT:
      return new Error(
        'Location request timed out. Please try again.',
      );

    default:
      return new Error(error.message || 'Unable to retrieve your location.');
  }
}

export async function getCurrentLocation(): Promise<UserLocation> {
  const geolocation = getBrowserGeolocation();

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => resolve(mapPosition(position)),
      error => reject(mapLocationError(error)),
      LOCATION_OPTIONS,
    );
  });
}

export async function watchUserLocation(
  onLocationUpdate: (location: UserLocation) => void,
  onError?: (error: Error) => void,
): Promise<string> {
  const geolocation = getBrowserGeolocation();

  const watchId = geolocation.watchPosition(
    position => onLocationUpdate(mapPosition(position)),
    error => onError?.(mapLocationError(error)),
    LOCATION_OPTIONS,
  );

  return String(watchId);
}

export async function stopWatchingLocation(
  watchId: string,
): Promise<void> {
  const geolocation = getBrowserGeolocation();
  geolocation.clearWatch(Number(watchId));
}
