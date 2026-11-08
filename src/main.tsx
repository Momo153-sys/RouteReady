import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './App.css';
import './index.css';
import App from './App.tsx';

import { diagnoseStopTimesSource } from './lib/gtfs/stop-times-key-diagnostic';

import {
  diagnoseTransitConnections,
  diagnoseTripStopTimeDistribution,
} from './repositories/journey-diagnostic';

if (import.meta.env.DEV) {
  Object.assign(window, {
    diagnoseStopTimesSource,
    diagnoseTransitConnections,
    diagnoseTripStopTimeDistribution,
  });
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);