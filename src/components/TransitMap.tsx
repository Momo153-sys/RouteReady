
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Stop } from '../domain/stops';
import type { Journey } from '../lib/routing/connection-scan';
import { openOfflineMap } from '../lib/offline-map/mbtiles';
import { registerOfflineMapProtocol } from '../lib/offline-map/protocol';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  watchUserLocation,
  stopWatchingLocation,
  type UserLocation,
} from '../lib/location';

setWorkerUrl(maplibreWorkerUrl);

interface TransitMapProps {
  stops?: Stop[];
  origin?: Stop | null;
  destination?: Stop | null;
  journeyStops?: Stop[];
  journey?: Journey | null;
}

type CoordinateStop = Stop & {
  latitude: number;
  longitude: number;
};

function hasCoordinates(stop: Stop): stop is CoordinateStop {
  return (
    typeof stop.latitude === 'number' &&
    Number.isFinite(stop.latitude) &&
    typeof stop.longitude === 'number' &&
    Number.isFinite(stop.longitude)
  );
}

function getWalkingSegmentKey(fromStopId: string, toStopId: string) {
  return `${fromStopId}->${toStopId}`;
}

function TransitMap({
  stops = [],
  origin = null,
  destination = null,
  journeyStops = [],
  journey = null,
}: TransitMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const watchId = useRef<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  // Initialize the offline map.
  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapContainer.current || map.current) return;

      try {
        await openOfflineMap();

        if (cancelled || !mapContainer.current) return;

        registerOfflineMapProtocol();

        const styleResponse = await fetch('/maps/style.json');

        if (!styleResponse.ok) {
          throw new Error(
            `Failed to load map style: HTTP ${styleResponse.status}`,
          );
        }

        const style = await styleResponse.json();

        if (!Array.isArray(style.sprite)) {
          throw new Error(
            'Invalid map style: sprite configuration is missing.',
          );
        }

        style.sprite = style.sprite.map(
          (sprite: { id: string; url: string }) => ({
            ...sprite,
            url: new URL(sprite.url, window.location.origin).href,
          }),
        );

        if (cancelled || !mapContainer.current) return;

        const newMap = new maplibregl.Map({
          container: mapContainer.current,
          style,
          center: [28.9784, 41.0082],
          zoom: 11,
          maxZoom: 14,
        });

        map.current = newMap;

        newMap.on('error', event => {
          console.error('[MapLibre error]', event.error);
        });

        newMap.addControl(
          new maplibregl.NavigationControl(),
          'top-right',
        );

        newMap.once('load', () => {
          if (!cancelled) {
            setMapReady(true);
          }
        });
      } catch (error) {
        console.error('Offline map initialization failed:', error);

        if (!cancelled) {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'Unable to initialize the offline map.',
          );
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;

      if (watchId.current) {
        void stopWatchingLocation(watchId.current);
        watchId.current = null;
      }

      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      userMarker.current?.remove();
      userMarker.current = null;

      map.current?.remove();
      map.current = null;

      setMapReady(false);
    };
  }, []);

  // Display nearby stops, origin, and destination.
  useEffect(() => {
    const currentMap = map.current;

    if (!currentMap || !mapReady) return;

    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    const addMarker = (
      stop: Stop,
      color: string,
      label: string,
    ) => {
      if (!hasCoordinates(stop)) return;

      const marker = new maplibregl.Marker({ color })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(
          new maplibregl.Popup().setText(`${label}: ${stop.name}`),
        )
        .addTo(currentMap);

      markers.current.push(marker);
    };

    stops.forEach(stop => {
      addMarker(stop, '#2563eb', 'Nearby stop');
    });

    if (origin) {
      addMarker(origin, '#16a34a', 'Origin');
    }

    if (destination) {
      addMarker(destination, '#dc2626', 'Destination');
    }
  }, [stops, origin, destination, mapReady]);

  // Display transit and walking sections as separate map lines.
  useEffect(() => {
    const currentMap = map.current;

    if (!currentMap || !mapReady) return;

    const sourceId = 'journey-route';
    const transitLayerId = 'journey-transit-line';
    const walkingLayerId = 'journey-walking-line';

    const removeJourneyLayers = () => {
      if (currentMap.getLayer(walkingLayerId)) {
        currentMap.removeLayer(walkingLayerId);
      }

      if (currentMap.getLayer(transitLayerId)) {
        currentMap.removeLayer(transitLayerId);
      }

      if (currentMap.getSource(sourceId)) {
        currentMap.removeSource(sourceId);
      }
    };

    removeJourneyLayers();

    if (!journey || journeyStops.length < 2) return;

    const walkingSegments = new Set(
      journey.legs
        .filter(leg => leg.type === 'walking')
        .map(leg =>
          getWalkingSegmentKey(leg.fromStopId, leg.toStopId),
        ),
    );

    const features = [];

    for (let index = 0; index < journeyStops.length - 1; index++) {
      const fromStop = journeyStops[index];
      const toStop = journeyStops[index + 1];

      if (!hasCoordinates(fromStop) || !hasCoordinates(toStop)) {
        continue;
      }

      const isWalking = walkingSegments.has(
        getWalkingSegmentKey(fromStop.id, toStop.id),
      );

      features.push({
        type: 'Feature' as const,
        properties: {
          type: isWalking ? 'walking' : 'transit',
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [fromStop.longitude, fromStop.latitude],
            [toStop.longitude, toStop.latitude],
          ],
        },
      });
    }

    const validJourneyStops = journeyStops.filter(hasCoordinates);

    if (features.length === 0 || validJourneyStops.length < 2) {
      return;
    }

    currentMap.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });

    currentMap.addLayer({
      id: transitLayerId,
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'type'], 'transit'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': 5,
        'line-opacity': 0.85,
      },
    });

    currentMap.addLayer({
      id: walkingLayerId,
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'type'], 'walking'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#0891b2',
        'line-width': 5,
        'line-opacity': 0.9,
        'line-dasharray': [2, 2],
      },
    });

    const coordinates = validJourneyStops.map(stop => [
      stop.longitude,
      stop.latitude,
    ] as [number, number]);

    const bounds = coordinates.reduce(
      (result, coordinate) => result.extend(coordinate),
      new maplibregl.LngLatBounds(
        coordinates[0],
        coordinates[0],
      ),
    );

    currentMap.fitBounds(bounds, {
      padding: 60,
      maxZoom: 14,
      duration: 800,
    });

    return removeJourneyLayers;
  }, [journey, journeyStops, mapReady]);

  // Start or stop GPS tracking.
  async function handleLocationTracking() {
    setLocationError('');

    if (watchId.current) {
      const currentWatchId = watchId.current;
      watchId.current = null;

      await stopWatchingLocation(currentWatchId);
      setIsLocating(false);
      return;
    }

    if (!mapReady) {
      setLocationError('The map is not ready yet.');
      return;
    }

    setIsLocating(true);

    try {
      const id = await watchUserLocation(
        location => {
          setUserLocation(location);

          const coordinates: [number, number] = [
            location.longitude,
            location.latitude,
          ];

          const currentMap = map.current;

          if (!currentMap) return;

          if (userMarker.current) {
            userMarker.current.setLngLat(coordinates);
          } else {
            userMarker.current = new maplibregl.Marker({
              color: '#0891b2',
            })
              .setLngLat(coordinates)
              .setPopup(
                new maplibregl.Popup().setText('Your current location'),
              )
              .addTo(currentMap);
          }

          currentMap.flyTo({
            center: coordinates,
            zoom: 14,
            essential: true,
          });
        },
        error => {
          setLocationError(error.message);
          setIsLocating(false);
          watchId.current = null;
        },
      );

      watchId.current = id;
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to retrieve your location.',
      );

      setIsLocating(false);
    }
  }

  return (
    <section className="transit-map">
      <div className="transit-map-frame">
        {!mapReady && (
          <div className="map-loading">
            <div className="map-loading-spinner" />
            <strong>Preparing your offline map</strong>
            <span>Loading Istanbul map data...</span>
          </div>
        )}

        <div
          ref={mapContainer}
          className="transit-map-canvas"
          aria-label="Istanbul public transport map"
        />

        <div className="map-overlay">
          <div className="map-overlay-label">
            <span className="map-live-dot" />
            {mapReady ? 'MAP READY' : 'INITIALIZING'}
          </div>
        </div>

        <button
          type="button"
          className={`map-location-button ${isLocating ? 'is-active' : ''}`}
          onClick={() => void handleLocationTracking()}
          disabled={!mapReady}
          aria-label={
            isLocating
              ? 'Stop following your location'
              : 'Locate me on the map'
          }
        >
          <span aria-hidden="true">{isLocating ? '⊙' : '◎'}</span>
          {isLocating ? 'Following you' : 'Locate me'}
        </button>
      </div>

      {(locationError || userLocation) && (
        <div className="map-feedback">
          {locationError && (
            <p className="error-message" role="alert">
              {locationError}
            </p>
          )}

          {userLocation && (
            <p className="map-accuracy">
              <span className="map-live-dot" />
              GPS accuracy: {Math.round(userLocation.accuracy)} m
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default TransitMap;
