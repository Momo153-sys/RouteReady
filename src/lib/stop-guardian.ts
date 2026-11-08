
import type { Stop } from '../domain/stops';
import {
  watchUserLocation,
  stopWatchingLocation,
} from './location';
import { calculateDistance } from './geo';

export interface StopGuardianOptions {
  destination: Stop;
  alertDistanceMeters?: number;
  onApproach: (distanceMeters: number) => void;
  onError?: (error: Error) => void;
}

export interface StopGuardianMonitor {
  stop: () => Promise<void>;
}

const DEFAULT_ALERT_DISTANCE_METERS = 300;

async function prepareNotifications(): Promise<ServiceWorkerRegistration> {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext
  ) {
    throw new Error(
      'Location and notifications require a secure HTTPS connection.',
    );
  }

  if (typeof Notification === 'undefined') {
    throw new Error(
      'Notifications are not supported by this browser.',
    );
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error(
      'Service workers are not supported by this browser.',
    );
  }

  if (Notification.permission === 'denied') {
    throw new Error(
      'Notification permission is blocked. Enable notifications in your browser settings.',
    );
  }

  // Request permission while handling the user's button interaction.
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    throw new Error(
      'RouteReady service worker is not registered.',
    );
  }

  const readyRegistration = registration.active
    ? registration
    : await navigator.serviceWorker.ready;

  if (typeof readyRegistration.showNotification !== 'function') {
    throw new Error(
      'Service worker notifications are unavailable on this device.',
    );
  }

  return readyRegistration;
}

export async function startStopGuardian(
  options: StopGuardianOptions,
): Promise<StopGuardianMonitor> {
  const {
    destination,
    alertDistanceMeters = DEFAULT_ALERT_DISTANCE_METERS,
    onApproach,
    onError,
  } = options;

  // Validate destination coordinates and narrow their TypeScript types.
  const destinationLatitude = destination.latitude;
  const destinationLongitude = destination.longitude;

  if (
    typeof destinationLatitude !== 'number' ||
    !Number.isFinite(destinationLatitude) ||
    typeof destinationLongitude !== 'number' ||
    !Number.isFinite(destinationLongitude)
  ) {
    throw new Error(
      'Destination coordinates are unavailable.',
    );
  }

  if (
    !Number.isFinite(alertDistanceMeters) ||
    alertDistanceMeters <= 0
  ) {
    throw new Error(
      'Alert distance must be greater than zero.',
    );
  }

  const notificationRegistration = await prepareNotifications();

  let hasAlerted = false;
  let stopRequested = false;
  let watcherCleared = false;
  let watchId: string | null = null;

  const stopWatcher = async (): Promise<void> => {
    stopRequested = true;

    if (watchId === null || watcherCleared) {
      return;
    }

    const currentWatchId = watchId;

    watchId = null;
    watcherCleared = true;

    try {
      await stopWatchingLocation(currentWatchId);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error(
              'Unable to stop location monitoring.',
            ),
      );
    }
  };

  try {
    const newWatchId = await watchUserLocation(
      (location) => {
        if (stopRequested || hasAlerted) {
          return;
        }

        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          destinationLatitude,
          destinationLongitude,
        );

        if (distance > alertDistanceMeters) {
          return;
        }

        hasAlerted = true;

        // Stop GPS monitoring after reaching the alert radius.
        void stopWatcher();

        // Display the destination notification through the service worker.
        void notificationRegistration.showNotification(
          'Approaching your destination',
          {
            body: `You are approximately ${Math.round(distance)} metres from ${destination.name}.`,
            tag: 'routeready-stop-guardian',
            data: {
              url: '/',
            },
          },
        ).catch((error: unknown) => {
          onError?.(
            error instanceof Error
              ? error
              : new Error(
                  'Unable to display destination notification.',
                ),
          );
        });

        onApproach(distance);
      },
      onError,
    );

    watchId = newWatchId;

    // Handle a stop request that occurred before watch setup completed.
    if (stopRequested) {
      await stopWatcher();
    }
  } catch (error) {
    await stopWatcher();

    throw error instanceof Error
      ? error
      : new Error('Unable to start Stop Guardian.');
  }

  return {
    stop: stopWatcher,
  };
}
