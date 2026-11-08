 declare global {
  interface Window {
    diagnoseStopTimes: typeof diagnoseStopTimes;
  }
}

import { useCallback, useEffect, useState } from 'react';
import {
  initializeDatabase,
  getStopCount,
} from './database/dexie';
import { loadOSMTransit } from './lib/import/osm-loader';
import {
  buildTransitGraph as buildGtfsConnections,
} from './lib/routing/transit-graph.builder';
import { generateWalkingConnections } from './lib/routing/walking-connections';
import { resetTransitGraphCache } from './lib/routing/transit-graph';
import JourneySearch from './components/JourneySearch';
import SavedPlaces from './components/SavedPlaces';
import {
  importGtfsData,
  type GtfsDatabaseImportResult,
  type GtfsImportProgress,
} from './lib/gtfs/database-importer';
import { diagnoseStopTimes } from './repositories/stop-time.repository';

type NavigationTab = 'home' | 'saved' | 'settings';

type SavedPlaceSelection = {
  place: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  type: 'origin' | 'destination';
};

let transitInitialization: Promise<void> | null = null;

function initializeTransitNetwork(): Promise<void> {
  if (!transitInitialization) {
    transitInitialization = (async () => {
      await initializeDatabase();

      // Import metro, tram, Marmaray and ferry data.
      await loadOSMTransit();

      

      // Generate walking links if they haven't been generated yet.
      await generateWalkingConnections();

      resetTransitGraphCache();
    })().catch((error) => {
      transitInitialization = null;
      throw error;
    });
  }

  return transitInitialization;
}

function App() {
  const [isReady, setIsReady] = useState(false);
  const [stopCount, setStopCount] = useState(0);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<GtfsImportProgress | null>(null);
  const [importResult, setImportResult] =
    useState<GtfsDatabaseImportResult | null>(null);

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');

  const [savedPlaceSelection, setSavedPlaceSelection] =
    useState<SavedPlaceSelection | null>(null);

  const handleSavedPlaceSelectionHandled = useCallback(() => {
    setSavedPlaceSelection(null);
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('routeready-theme');

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

 

useEffect(() => {
  window.diagnoseStopTimes = diagnoseStopTimes;
}, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('routeready-theme', theme);
  }, [theme]);

  useEffect(() => {
  async function initialize() {
    try {
      await initializeTransitNetwork();

      const count = await getStopCount();
      setStopCount(count);
      setIsReady(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initialize the transit network.',
      );
    }
  }

  void initialize();
}, []);

  useEffect(() => {
    const handleSavedPlaceSelection = (event: Event) => {
      const customEvent = event as CustomEvent<SavedPlaceSelection>;

      setSavedPlaceSelection(customEvent.detail);
      setActiveTab('home');
    };

    window.addEventListener(
      'routeready:select-saved-place',
      handleSavedPlaceSelection,
    );

    return () => {
      window.removeEventListener(
        'routeready:select-saved-place',
        handleSavedPlaceSelection,
      );
    };
  }, []);

  async function handleImport() {
    if (isImporting) return;

    setIsImporting(true);
    setError('');
    setImportResult(null);
    setProgress({
      stage: 'fetching',
      message: 'Starting transit data import...',
    });

    try {
      const result = await importGtfsData(setProgress);

setProgress({
  stage: 'stop-times',
  message: 'Generating transit connections...',
  processed: result.stopTimesImported,
});

const graphResult = await buildGtfsConnections();

console.info('[RouteReady] GTFS connections generated:', graphResult);

await generateWalkingConnections();
resetTransitGraphCache();

      setImportResult(result);

      const count = await getStopCount();
      setStopCount(count);

      // Run the lightweight stop-time diagnostic after importing.
      await diagnoseStopTimes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Transit data import failed.',
      );
    } finally {
      setIsImporting(false);
    }
  }

  if (error && !isReady) {
    return (
      <main className="app-shell">
        <div className="app-container">
          <p className="error-message">{error}</p>
        </div>
      </main>
    );
  }

  if (!isReady) {
    return (
      <main className="app-shell">
        <div className="app-container">
          <p>Loading RouteReady...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container header-content">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              R
            </div>

            <div className="brand-name">
              Route<span>Ready</span>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setTheme(current =>
                  current === 'light' ? 'dark' : 'light',
                )
              }
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </header>

      <main className="app-container home-content">
        {activeTab === 'home' && (
          <>
            <section className="welcome-section">
              <div className="welcome-eyebrow">
                <span>●</span>
                ISTANBUL PUBLIC TRANSPORT
              </div>

              <h1 className="welcome-title">
                Move around the city.
                <br />
                <span>On your terms.</span>
              </h1>

              <p className="welcome-description">
                Plan your journeys and explore Istanbul's public transport,
                even when you're offline.
              </p>
            </section>

            <section className="journey-card">
              <div className="journey-card-header">
                <div>
                  <h2 className="journey-card-title">Transit data</h2>
                  <p className="journey-card-subtitle">
                    Your locally stored Istanbul transport network
                  </p>
                </div>

                <div className="offline-badge">
                  <span>●</span>
                  Offline data
                </div>
              </div>

              <div className="data-status">
                <div>
                  <strong>{stopCount.toLocaleString()}</strong>
                  <span>Stops available locally</span>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importing...' : '↻ Update data'}
                </button>
              </div>

              {progress && (
                <div className="status-message" aria-live="polite">
                  <p>{progress.message}</p>

                  {progress.stage === 'stop-times' && (
                    <p>
                      Records processed:{' '}
                      {(progress.processed ?? 0).toLocaleString()}
                    </p>
                  )}

                  {progress.stage === 'completed' && (
                    <p>Import completed successfully.</p>
                  )}
                </div>
              )}

              {error && (
                <p className="error-message" role="alert">
                  Import error: {error}
                </p>
              )}

              {importResult && (
                <details className="import-summary">
                  <summary>View import summary</summary>
                  <ul>
                    <li>
                      Agencies: {importResult.agenciesImported.toLocaleString()}
                    </li>
                    <li>
                      Stops: {importResult.stopsImported.toLocaleString()}
                    </li>
                    <li>
                      Routes: {importResult.routesImported.toLocaleString()}
                    </li>
                    <li>
                      Calendars: {importResult.calendarsImported.toLocaleString()}
                    </li>
                    <li>
                      Trips: {importResult.tripsImported.toLocaleString()}
                    </li>
                    <li>
                      Stop times: {importResult.stopTimesImported.toLocaleString()}
                    </li>
                  </ul>
                </details>
              )}
            </section>

            <JourneySearch
              savedPlaceSelection={savedPlaceSelection}
              onSavedPlaceSelectionHandled={handleSavedPlaceSelectionHandled}
            />
          </>
        )}

        {activeTab === 'saved' && <SavedPlaces />}

        {activeTab === 'settings' && (
          <section className="settings-page">
            <header className="settings-header">
              <span className="welcome-eyebrow">PERSONALIZE YOUR APP</span>
              <h1 className="saved-places-title">Settings</h1>
              <p className="saved-places-description">
                Manage your RouteReady preferences.
              </p>
            </header>

            <div className="settings-section">
              <h2>Appearance</h2>

              <div className="settings-option">
                <div>
                  <strong>Theme</strong>
                  <p>Choose how RouteReady looks.</p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setTheme(current =>
                      current === 'light' ? 'dark' : 'light',
                    )
                  }
                >
                  {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h2>Offline data</h2>

              <div className="settings-option">
                <div>
                  <strong>Istanbul transit network</strong>
                  <p>
                    {stopCount.toLocaleString()} stops stored locally.
                  </p>
                </div>

                <span className="offline-badge">
                  <span>●</span>
                  Available
                </span>
              </div>

              <button
                type="button"
                className="secondary-button settings-update-button"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? 'Updating...' : '↻ Update transit data'}
              </button>

              {progress && (
                <p className="status-message" aria-live="polite">
                  {progress.message}
                </p>
              )}

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="settings-about">
              <div className="brand">
                <div className="brand-mark" aria-hidden="true">R</div>
                <div className="brand-name">
                  Route<span>Ready</span>
                </div>
              </div>
              <p>Explore Istanbul. Even offline.</p>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-navigation" aria-label="Main navigation">
        <button
          type="button"
          className={`bottom-navigation-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <span className="bottom-navigation-icon" aria-hidden="true">⌂</span>
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`bottom-navigation-item ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved')}
          aria-current={activeTab === 'saved' ? 'page' : undefined}
        >
          <span className="bottom-navigation-icon" aria-hidden="true">♡</span>
          <span>Saved</span>
        </button>

        <button
          type="button"
          className={`bottom-navigation-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <span className="bottom-navigation-icon" aria-hidden="true">⚙</span>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
