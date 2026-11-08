
import { useCallback, useEffect, useState } from 'react';
import {
  getAllSavedPlaces,
  deleteSavedPlace,
  type SavedPlace,
} from '../repositories/saved-place.repository';

const SAVED_PLACES_CHANGED_EVENT = 'routeready:saved-places-changed';
const SELECT_SAVED_PLACE_EVENT = 'routeready:select-saved-place';

function SavedPlaces() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlaces = useCallback(async () => {
    setError('');

    try {
      const savedPlaces = await getAllSavedPlaces();
      setPlaces(savedPlaces);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load saved places.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const savedPlaces = await getAllSavedPlaces();

        if (!cancelled) {
          setPlaces(savedPlaces);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load saved places.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initialLoad();

    function handleSavedPlacesChanged() {
      void loadPlaces();
    }

    window.addEventListener(
      SAVED_PLACES_CHANGED_EVENT,
      handleSavedPlacesChanged,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        SAVED_PLACES_CHANGED_EVENT,
        handleSavedPlacesChanged,
      );
    };
  }, [loadPlaces]);

  function handleUsePlace(
  place: SavedPlace,
  type: 'origin' | 'destination',
) {
  window.dispatchEvent(
    new CustomEvent(SELECT_SAVED_PLACE_EVENT, {
      detail: {
        place,
        type,
      },
    }),
  );
}


  async function handleDelete(id: string) {
    setError('');

    try {
      await deleteSavedPlace(id);

      setPlaces(current =>
        current.filter(place => place.id !== id),
      );

      window.dispatchEvent(
        new Event(SAVED_PLACES_CHANGED_EVENT),
      );
    } catch {
      setError('Unable to delete this saved place.');
    }
  }

  return (
    <section className="saved-places-page">
      <header className="saved-places-header">
        <div>
          <span className="welcome-eyebrow">
            YOUR COLLECTION
          </span>

          <h1 className="saved-places-title">
            Saved places
          </h1>

          <p className="saved-places-description">
            Your favorite locations, always available offline.
          </p>
        </div>

        <div className="saved-places-count">
          <strong>{places.length}</strong>
          <span>Saved</span>
        </div>
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="saved-places-empty">
          <div className="map-loading-spinner" />
          <p>Loading your saved places...</p>
        </div>
      ) : places.length === 0 ? (
        <div className="saved-places-empty">
          <div className="saved-places-empty-icon">
            <span>⌖</span>
          </div>

          <h2>No saved places yet</h2>

          <p>
            Save locations you visit frequently to find them
            quickly whenever you need them.
          </p>
        </div>
      ) : (
        <div className="saved-places-list">
          {places.map(place => (
            <article
              className="saved-place-card"
              key={place.id}
            >
              <div className="saved-place-icon">
                <span>⌖</span>
              </div>

              <div className="saved-place-details">
  <h2>{place.name}</h2>

  <p>
    {place.latitude.toFixed(5)},{' '}
    {place.longitude.toFixed(5)}
  </p>

  <div className="saved-place-actions">
    <button
      type="button"
      onClick={() => handleUsePlace(place, 'origin')}
    >
      Use as origin
    </button>

    <button
      type="button"
      onClick={() => handleUsePlace(place, 'destination')}
    >
      Use as destination
    </button>
  </div>
</div>

              <button
                type="button"
                className="saved-place-delete"
                onClick={() => void handleDelete(place.id)}
                aria-label={`Delete ${place.name}`}
                title="Remove saved place"
              >
                <span aria-hidden="true">×</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default SavedPlaces;
