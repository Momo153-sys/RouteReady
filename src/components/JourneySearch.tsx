
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Stop } from '../domain/stops';

import {
  getStopById,
  searchStops,
} from '../repositories/stop.repository';

import type { NearbyStop } from '../repositories/stop.repository';

import {
  getAllSavedPlaces,
  savePlace,
} from '../repositories/saved-place.repository';

import { findNearbyStops } from '../lib/nearby-stops';

import {
  searchJourney,
  type JourneySearchResult,
} from '../lib/routing/journey.service';

import TransitMap from './TransitMap';

import {
  startStopGuardian,
  type StopGuardianMonitor,
} from '../lib/stop-guardian';

const SAVED_PLACES_CHANGED_EVENT = 'routeready:saved-places-changed';

type JourneySearchProps = {
  savedPlaceSelection: {
    place: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
    };
    type: 'origin' | 'destination';
  } | null;
  onSavedPlaceSelectionHandled: () => void;
};

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

function formatWalkingDistance(distanceMeters: number): string {
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}


function getStopMetadata(stop: Stop): {
  lines: string | null;
  direction: string | null;
} {
  const description = stop.description?.trim();

  if (!description) {
    return { lines: null, direction: null };
  }

  const linesMatch = description.match(
    /lines\s*:\s*([^;|]+)/i,
  );

  const directionMatch = description.match(
    /direction\s*:\s*([^,;|]+)/i,
  );

  return {
    lines: linesMatch?.[1]?.trim() || null,
    direction: directionMatch?.[1]?.trim() || null,
  };
}

function StopDirection({ stop }: { stop: Stop }) {
  const { lines, direction } = getStopMetadata(stop);

  if (!lines && !direction) return null;

  return (
    <span className="stop-direction">
      {lines && <small>Lines: {lines}</small>}
      {direction && <small>Direction: {direction}</small>}
    </span>
  );
}


function JourneySearch({
  savedPlaceSelection,
  onSavedPlaceSelectionHandled,
}: JourneySearchProps) {
  const [origin, setOrigin] = useState<Stop | null>(null);
  const [destination, setDestination] = useState<Stop | null>(null);

  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');

  const [originResults, setOriginResults] = useState<Stop[]>([]);
  const [destinationResults, setDestinationResults] = useState<Stop[]>([]);
  const [nearbyStops, setNearbyStops] = useState<NearbyStop[]>([]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [journeys, setJourneys] = useState<JourneySearchResult[]>([]);
  const [selectedJourneyIndex, setSelectedJourneyIndex] = useState(0);

  const selectedJourneyResult = journeys[selectedJourneyIndex] ?? null;
  const journey = selectedJourneyResult?.journey ?? null;
  const journeyStops = selectedJourneyResult?.stops ?? [];

  const [isGuardianActive, setIsGuardianActive] = useState(false);
  const [guardianMessage, setGuardianMessage] = useState('');

  const [savingStopId, setSavingStopId] = useState<string | null>(null);
  const [savedStopIds, setSavedStopIds] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState('');

  const guardianMonitor = useRef<StopGuardianMonitor | null>(null);

  const clearJourney = useCallback(() => {
    setJourneys([]);
    setSelectedJourneyIndex(0);
    setGuardianMessage('');
  }, []);

  const selectStop = useCallback(
    (stop: Stop, type: 'origin' | 'destination') => {
      setLocationError('');
      setSaveMessage('');
      clearJourney();

      if (type === 'origin') {
        setOrigin(stop);
        setOriginQuery(stop.name);
        setOriginResults([]);
        setNearbyStops([]);
      } else {
        setDestination(stop);
        setDestinationQuery(stop.name);
        setDestinationResults([]);
      }
    },
    [clearJourney],
  );


const handleSwapStops = useCallback(() => {
  setOrigin(destination);
  setDestination(origin);

  setOriginQuery(destinationQuery);
  setDestinationQuery(originQuery);

  setOriginResults([]);
  setDestinationResults([]);
  setNearbyStops([]);
  setLocationError('');
  setSaveMessage('');

  // Stop monitoring the previous destination.
  if (guardianMonitor.current) {
    void guardianMonitor.current.stop();
    guardianMonitor.current = null;
  }

  setIsGuardianActive(false);
  clearJourney();
}, [
  origin,
  destination,
  originQuery,
  destinationQuery,
  clearJourney,
]);


  async function handleSavePlace(stop: Stop) {
    setSaveMessage('');

    if (
      stop.latitude === undefined ||
      stop.longitude === undefined
    ) {
      setSaveMessage(
        `${stop.name} cannot be saved as a location because its coordinates are unavailable.`,
      );
      return;
    }

    setSavingStopId(stop.id);

    try {
      await savePlace({
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });

      setSavedStopIds(current =>
        current.includes(stop.id) ? current : [...current, stop.id],
      );

      window.dispatchEvent(new Event(SAVED_PLACES_CHANGED_EVENT));

      setSaveMessage(`${stop.name} saved successfully.`);
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save this location.',
      );
    } finally {
      setSavingStopId(null);
    }
  }

  async function handleStopSearch(
    query: string,
    type: 'origin' | 'destination',
  ) {
    if (type === 'origin') {
      setOriginResults([]);
    } else {
      setDestinationResults([]);
    }

    if (query.trim().length < 2) return;

    try {
      const results = await searchStops(query);

      if (type === 'origin') {
        setOriginResults(results);
      } else {
        setDestinationResults(results);
      }
    } catch (error) {
      console.error('Stop search failed:', error);
      setLocationError('Unable to search stops. Please try again.');
    }
  }

  async function handleCurrentLocation() {
    setIsLocating(true);
    setLocationError('');
    setNearbyStops([]);

    try {
      const results = await findNearbyStops(1);

      setNearbyStops(results);

      if (results.length === 0) {
        setLocationError('No stops found within 1 km of your location.');
      }
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to retrieve your location.',
      );
    } finally {
      setIsLocating(false);
    }
  }

  async function handleJourneySearch() {
    if (!origin || !destination) return;

    const originId = origin.id;
    const destinationId = destination.id;

    setIsSearching(true);
    setLocationError('');
    clearJourney();

    try {
      const results = await searchJourney({
        originStopId: originId,
        destinationStopId: destinationId,
      });

      if (results.length === 0) {
        setLocationError(
          'No connections found between these stops in the imported transit data.',
        );
        return;
      }

      setJourneys(results);
      setSelectedJourneyIndex(0);
    } catch (error) {
      console.error('Journey search failed:', error);

      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to find transit connections.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleStartGuardian() {
    if (!destination || !journey) return;

    if (
      destination.latitude === undefined ||
      destination.longitude === undefined
    ) {
      setGuardianMessage(
        'Stop Guardian is unavailable because this stop has no valid coordinates.',
      );
      return;
    }

    setGuardianMessage('');

    try {
      const monitor = await startStopGuardian({
        destination,
        alertDistanceMeters: 300,
        onApproach: distance => {
          setGuardianMessage(
            `You are ${Math.round(distance)} metres from your destination stop.`,
          );
          setIsGuardianActive(false);
          guardianMonitor.current = null;
        },
        onError: error => {
          setGuardianMessage(error.message);
        },
      });

      guardianMonitor.current = monitor;
      setIsGuardianActive(true);
      setGuardianMessage('Stop Guardian is monitoring your destination.');
    } catch (error) {
      setGuardianMessage(
        error instanceof Error
          ? error.message
          : 'Unable to activate Stop Guardian.',
      );
    }
  }

  async function handleStopGuardian() {
    await guardianMonitor.current?.stop();
    guardianMonitor.current = null;
    setIsGuardianActive(false);
    setGuardianMessage('Stop Guardian stopped.');
  }

  useEffect(() => {
    return () => {
      if (guardianMonitor.current) {
        void guardianMonitor.current.stop();
        guardianMonitor.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPlaces() {
      try {
        const places = await getAllSavedPlaces();

        if (!cancelled) {
          setSavedStopIds(places.map(place => place.id));
        }
      } catch (error) {
        console.error('Unable to load saved places:', error);
      }
    }

    void loadSavedPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!savedPlaceSelection) return;

    const selection = savedPlaceSelection;
    let cancelled = false;

    async function applySavedPlace() {
      try {
        const { place, type } = selection;
        const selectedStop = await getStopById(place.id);

        if (cancelled) return;

        if (!selectedStop) {
          setLocationError(
            'Unable to find this saved stop in the transit database.',
          );
          onSavedPlaceSelectionHandled();
          return;
        }

        selectStop(selectedStop, type);
        onSavedPlaceSelectionHandled();
      } catch (error) {
        if (!cancelled) {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'Unable to load the selected saved place.',
          );
          onSavedPlaceSelectionHandled();
        }
      }
    }

    void applySavedPlace();

    return () => {
      cancelled = true;
    };
  }, [
    savedPlaceSelection,
    onSavedPlaceSelectionHandled,
    selectStop,
  ]);

  return (
    <section className="journey-search">
      <section className="journey-card planner-card">
        <div className="journey-card-header">
          <div>
            <div className="welcome-eyebrow">YOUR NEXT JOURNEY</div>
            <h2 className="journey-card-title">Where are you going?</h2>
            <p className="journey-card-subtitle">
              Choose your starting point and destination.
            </p>
          </div>

          <div className="planner-icon" aria-hidden="true">↗</div>
        </div>

        <div className="journey-fields">
          <div className="field-group">
            <label className="field-label" htmlFor="origin">FROM</label>

            <div className="field-wrapper">
              <span className="field-indicator" />
              <input
                id="origin"
                value={originQuery}
                placeholder="Search starting stop"
                autoComplete="off"
                onChange={event => {
                  setOriginQuery(event.target.value);
                  setOrigin(null);
                  clearJourney();
                  void handleStopSearch(event.target.value, 'origin');
                }}
              />
            </div>

            {originResults.length > 0 && (
              <div className="suggestion-list">
                {originResults.map(stop => (
                  <button
                    key={stop.id}
                    type="button"
                    className="suggestion-item"
                    onClick={() => selectStop(stop, 'origin')}
                  >
                    <span className="suggestion-dot origin-dot" />
                    <span className="suggestion-stop-info">
                      <strong>{stop.name}</strong>
                      <StopDirection stop={stop} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {origin && (
              <div className="selected-stop-row">
                <div className="selected-stop-info">
                  <p className="selected-stop">
                    <span>✓</span> {origin.name}
                  </p>
                  <StopDirection stop={origin} />
                </div>

                <button
                  type="button"
                  className="save-stop-button"
                  disabled={
                    savingStopId === origin.id ||
                    savedStopIds.includes(origin.id)
                  }
                  onClick={() => void handleSavePlace(origin)}
                >
                  {savedStopIds.includes(origin.id)
                    ? '♥ Saved'
                    : savingStopId === origin.id
                      ? 'Saving...'
                      : '♡ Save location'}
                </button>
              </div>
            )}

            <button
              type="button"
              className="location-button"
              onClick={() => void handleCurrentLocation()}
              disabled={isLocating}
            >
              <span aria-hidden="true">◎</span>
              {isLocating
                ? 'Finding your location...'
                : 'Use my current location'}
            </button>
          </div>

<button
  type="button"
  className="swap-stops-button"
  onClick={handleSwapStops}
  aria-label="Switch starting point and destination"
  title="Switch starting point and destination"
>
  <span aria-hidden="true">⇄</span>
</button>


          <div className="field-group">
            <label className="field-label" htmlFor="destination">TO</label>

            <div className="field-wrapper">
              <span className="field-indicator destination" />
              <input
                id="destination"
                value={destinationQuery}
                placeholder="Search destination stop"
                autoComplete="off"
                onChange={event => {
                  setDestinationQuery(event.target.value);
                  setDestination(null);
                  clearJourney();
                  void handleStopSearch(event.target.value, 'destination');
                }}
              />
            </div>

            {destinationResults.length > 0 && (
              <div className="suggestion-list">
                {destinationResults.map(stop => (
                  <button
                    key={stop.id}
                    type="button"
                    className="suggestion-item"
                    onClick={() => selectStop(stop, 'destination')}
                  >
                    <span className="suggestion-dot destination-dot" />
                    <span className="suggestion-stop-info">
                      <strong>{stop.name}</strong>
                      <StopDirection stop={stop} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {destination && (
              <div className="selected-stop-row">
                <div className="selected-stop-info">
                  <p className="selected-stop">
                    <span>✓</span> {destination.name}
                  </p>
                  <StopDirection stop={destination} />
                </div>

                <button
                  type="button"
                  className="save-stop-button"
                  disabled={
                    savingStopId === destination.id ||
                    savedStopIds.includes(destination.id)
                  }
                  onClick={() => void handleSavePlace(destination)}
                >
                  {savedStopIds.includes(destination.id)
                    ? '♥ Saved'
                    : savingStopId === destination.id
                      ? 'Saving...'
                      : '♡ Save location'}
                </button>
              </div>
            )}
          </div>
        </div>

        {saveMessage && (
          <p className="save-feedback" role="status">{saveMessage}</p>
        )}

        {locationError && (
          <p className="error-message" role="alert">{locationError}</p>
        )}

        <div className="journey-actions">
          <span className="planner-hint">
            <span>●</span> Works with offline transit data
          </span>

          <button
            type="button"
            className="primary-button"
            disabled={!origin || !destination || isSearching}
            onClick={() => void handleJourneySearch()}
          >
            {isSearching ? 'Finding connections...' : 'Find connections'}
            {!isSearching && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </section>

      {nearbyStops.length > 0 && (
        <section className="nearby-section">
          <div className="section-heading">
            <div>
              <h2>Stops near you</h2>
              <p className="section-description">
                Select a nearby stop as your starting point.
              </p>
            </div>
            <span className="count-badge">{nearbyStops.length}</span>
          </div>

          <div className="nearby-list">
            {nearbyStops.map(({ stop, distanceKm }) => (
              <button
                key={stop.id}
                type="button"
                className="nearby-stop"
                onClick={() => selectStop(stop, 'origin')}
              >
                <span className="nearby-stop-icon">◎</span>
                <span className="nearby-stop-info">
                  <strong>{stop.name}</strong>
                  <StopDirection stop={stop} />
                  <small>{formatDistance(distanceKm)}</small>
                </span>
                <span className="nearby-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {journeys.length > 0 && (
        <section className="journey-result">
          <div className="section-heading">
            <div>
              <div className="welcome-eyebrow">YOUR CONNECTIONS</div>
              <h2>Choose your journey</h2>
              <p className="section-description">
                {journeys.length} possible connection
                {journeys.length === 1 ? '' : 's'} found
              </p>
            </div>

            <span className="result-badge">{journeys.length} options</span>
          </div>

          <div className="journey-options-list">
            {journeys.map((result, index) => {
              const selected = selectedJourneyIndex === index;
              const legs = result.journey.legs;

              return (
                <button
                  key={`${legs.map(leg =>
                    leg.type === 'walking'
                      ? `walk-${leg.fromStopId}-${leg.toStopId}`
                      : `transit-${leg.routeId}-${leg.fromStopId}-${leg.toStopId}`
                  ).join('|')}-${index}`}
                  type="button"
                  className={`journey-option ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedJourneyIndex(index)}
                >
                  <div className="journey-option-top">
                    <span className="journey-option-title">
                      Option {index + 1}
                    </span>

                    <span className="journey-transfer-badge">
                      {result.journey.transfers === 0
                        ? 'Direct'
                        : `${result.journey.transfers} transfer${result.journey.transfers === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div className="journey-route-chips">
                    {legs.map((leg, legIndex) => (
                      <span
                        key={`${leg.fromStopId}-${leg.toStopId}-${legIndex}`}
                        className="journey-route-chip"
                      >
                        {leg.type === 'walking'
                          ? `Walk ${formatWalkingDistance(leg.distanceMeters)}`
                          : leg.routeName}
                      </span>
                    ))}
                  </div>

                  <div className="journey-option-bottom">
                    <span>
                      {legs.length} section{legs.length === 1 ? '' : 's'}
                    </span>
                    <span>
                      {selected ? 'Selected ✓' : 'View journey →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {journey && (
            <div className="selected-journey-details">
              <div className="itinerary-header">
                <div>
                  <span className="welcome-eyebrow">SELECTED JOURNEY</span>
                  <h3>Your travel itinerary</h3>
                </div>

                <span className="itinerary-transfer-count">
                  {journey.transfers === 0
                    ? 'Direct'
                    : `${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}`}
                </span>
              </div>

              <div className="itinerary-endpoints">
                <div className="itinerary-endpoint">
                  <span className="itinerary-origin-marker" />
                  <div>
                    <small>START</small>
                    <strong>{origin?.name}</strong>
                    {origin && <StopDirection stop={origin} />}
                  </div>
                </div>

                <div className="itinerary-endpoint">
                  <span className="itinerary-destination-marker" />
                  <div>
                    <small>DESTINATION</small>
                    <strong>{destination?.name}</strong>
                    {destination && <StopDirection stop={destination} />}
                  </div>
                </div>
              </div>

              <div className="itinerary-timeline">
                {journey.legs.map((leg, index) => {
                  const isWalking = leg.type === 'walking';

                  return (
                    <div
                      className={`itinerary-leg ${isWalking ? 'walking-leg' : 'transit-leg'}`}
                      key={`${leg.fromStopId}-${leg.toStopId}-${index}`}
                    >
                      <div className="itinerary-line-column">
                        <div className="itinerary-route-marker">
                          {isWalking ? '🚶 Walking' : leg.routeName}
                        </div>

                        {index < journey.legs.length - 1 && (
                          <div className="itinerary-line" />
                        )}
                      </div>

                      <div className="itinerary-leg-content">
                        <div className="itinerary-leg-heading">
                          <span>
                            {isWalking ? 'WALKING SECTION' : `ROUTE ${index + 1}`}
                          </span>
                          <strong>
                            {isWalking
                              ? `${formatWalkingDistance(leg.distanceMeters)} · ${leg.durationMinutes} min`
                              : leg.routeName}
                          </strong>
                        </div>

                        <div className="itinerary-stop">
                          <span className="itinerary-stop-dot" />
                          <div>
                            <small>{isWalking ? 'WALK FROM' : 'BOARD AT'}</small>
                            <strong>{leg.fromStopName}</strong>
                          </div>
                        </div>

                        <div className="itinerary-stop itinerary-stop-end">
                          <span className="itinerary-stop-square" />
                          <div>
                            <small>
                              {isWalking
                                ? 'WALK TO'
                                : index === journey.legs.length - 1
                                  ? 'GET OFF AT'
                                  : 'GET OFF TO TRANSFER'}
                            </small>
                            <strong>{leg.toStopName}</strong>
                          </div>
                        </div>

                        {index < journey.legs.length - 1 && (
                          <div className="itinerary-transfer">
                            <span>{isWalking ? '🚶' : '↻'}</span>
                            {isWalking
                              ? 'Continue on foot'
                              : 'Change route here'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {journeyStops.length > 0 && (
                <details className="itinerary-stops">
                  <summary>
                    <span>View all stops along this journey</span>
                    <span className="itinerary-stop-count">
                      {journeyStops.length} stops
                    </span>
                  </summary>

                  <ol>
                    {journeyStops.map((stop, index) => {
                      const isOrigin = stop.id === origin?.id;
                      const isDestination = stop.id === destination?.id;

                      const isTransfer = journey.legs.some(
                        (leg, legIndex) =>
                          leg.type === 'transit' &&
                          journey.legs
                            .slice(legIndex + 1)
                            .some(nextLeg =>
                              nextLeg.type === 'transit' &&
                              nextLeg.fromStopId === leg.toStopId
                            ) &&
                          leg.toStopId === stop.id
                      );

                      return (
                        <li
                          key={`${stop.id}-${index}`}
                          className={isTransfer ? 'is-transfer-stop' : ''}
                        >
                          <span className="itinerary-sequence">{index + 1}</span>
                          <span className="itinerary-stop-name">
                            {stop.name}
                          </span>

                          <StopDirection stop={stop} />

                          {isOrigin && <span className="stop-tag">Start</span>}
                          {isDestination && (
                            <span className="stop-tag destination-tag">End</span>
                          )}
                          {isTransfer && (
                            <span className="stop-tag transfer-tag">Transfer</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              )}

              <section className="guardian-card">
                <div className="guardian-icon">◉</div>

                <div className="guardian-content">
                  <h3>Stop Guardian</h3>
                  <p>
                    Get an alert when you're approaching your destination.
                  </p>

                  {guardianMessage && (
                    <p className="guardian-message" role="status">
                      {guardianMessage}
                    </p>
                  )}

                  {!isGuardianActive ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleStartGuardian()}
                    >
                      Activate Stop Guardian
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleStopGuardian()}
                    >
                      Stop monitoring
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      <section className="map-section">
        <div className="section-heading">
          <div>
            <div className="welcome-eyebrow">EXPLORE THE CITY</div>
            <h2>Istanbul map</h2>
            <p className="section-description">
              Explore the offline map and nearby transport stops.
            </p>
          </div>

          <span className="map-status">
            <span /> Offline map
          </span>
        </div>

        <div className="map-card">
          <TransitMap
            stops={nearbyStops.map(item => item.stop)}
            origin={origin}
            destination={destination}
            journey={journey}
            journeyStops={journeyStops}
          />
        </div>
      </section>
    </section>
  );
}

export default JourneySearch;
