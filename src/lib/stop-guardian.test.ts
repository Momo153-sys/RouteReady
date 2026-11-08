
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Stop } from '../domain/stops';
import {
  watchBackgroundLocation,
  stopBackgroundLocation,
} from './background-location';
import {
  startStopGuardian,
} from './stop-guardian';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    schedule: vi.fn(),
  },
}));

vi.mock('./background-location', () => ({
  watchBackgroundLocation: vi.fn(),
  stopBackgroundLocation: vi.fn(),
}));

const destination: Stop = {
  id: 'stop-1',
  name: 'Test Destination',
  latitude: 41.0082,
  longitude: 28.9784,
  locationType: 0,
};

describe('Stop Guardian', () => {
  let locationCallback:
    | ((location: {
        latitude: number;
        longitude: number;
        accuracy: number;
      }) => void)
    | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    locationCallback = undefined;

    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({
      display: 'granted',
    });

    vi.mocked(LocalNotifications.schedule).mockResolvedValue({
      notifications: [],
    });

    vi.mocked(watchBackgroundLocation).mockImplementation(
      async options => {
        locationCallback = options.onLocationUpdate;
        return 'watcher-1';
      }
    );

    vi.mocked(stopBackgroundLocation).mockResolvedValue(undefined);
  });

  it('starts background location tracking', async () => {
    await startStopGuardian({
      destination,
      onApproach: vi.fn(),
    });

    expect(watchBackgroundLocation).toHaveBeenCalledOnce();
  });

  it('requests notification permission when not granted', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({
      display: 'prompt',
    });

    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({
      display: 'granted',
    });

    await startStopGuardian({
      destination,
      onApproach: vi.fn(),
    });

    expect(LocalNotifications.requestPermissions).toHaveBeenCalledOnce();
  });

  it('throws when notification permission is denied', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({
      display: 'prompt',
    });

    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({
      display: 'denied',
    });

    await expect(
      startStopGuardian({
        destination,
        onApproach: vi.fn(),
      })
    ).rejects.toThrow('Notification permission was not granted.');

    expect(watchBackgroundLocation).not.toHaveBeenCalled();
  });

  it('alerts when the user reaches the destination radius', async () => {
    const onApproach = vi.fn();

    await startStopGuardian({
      destination,
      alertDistanceMeters: 300,
      onApproach,
    });

    locationCallback?.({
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    });

    expect(onApproach).toHaveBeenCalledOnce();
    expect(onApproach).toHaveBeenCalledWith(0);
    expect(LocalNotifications.schedule).toHaveBeenCalledOnce();
  });

  it('does not alert more than once', async () => {
    const onApproach = vi.fn();

    await startStopGuardian({
      destination,
      onApproach,
    });

    const location = {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    };

    locationCallback?.(location);
    locationCallback?.(location);

    expect(onApproach).toHaveBeenCalledOnce();
    expect(LocalNotifications.schedule).toHaveBeenCalledOnce();
  });

  it('stops background tracking after the destination alert', async () => {
    await startStopGuardian({
      destination,
      onApproach: vi.fn(),
    });

    locationCallback?.({
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    });

    expect(stopBackgroundLocation).toHaveBeenCalledWith('watcher-1');
  });

  it('stops background tracking when manually stopped', async () => {
    const monitor = await startStopGuardian({
      destination,
      onApproach: vi.fn(),
    });

    await monitor.stop();

    expect(stopBackgroundLocation).toHaveBeenCalledWith('watcher-1');
  });

  it('does not stop the same watcher more than once', async () => {
    const monitor = await startStopGuardian({
      destination,
      onApproach: vi.fn(),
    });

    await monitor.stop();
    await monitor.stop();

    expect(stopBackgroundLocation).toHaveBeenCalledOnce();
  });

  it('reports background location errors', async () => {
    const onError = vi.fn();

    await startStopGuardian({
      destination,
      onApproach: vi.fn(),
      onError,
    });

    const watcherOptions = vi.mocked(watchBackgroundLocation).mock.calls[0][0];

    watcherOptions.onError?.(new Error('GPS unavailable'));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'GPS unavailable',
      })
    );
  });
});
