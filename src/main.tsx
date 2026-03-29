import { render } from 'preact';
import { LocationProvider } from 'preact-iso';
import { App } from './app';
import { NavSlotProvider } from './components/NavSlot';
import './app.css';
import { isNative, configureStatusBar } from './native';

// Detect standalone PWA mode (especially iOS) or native app
const isStandalone =
  isNative ||
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

if (isStandalone) {
  document.documentElement.classList.add('pwa-standalone');
}

// Configure native shell (no-ops on web)
configureStatusBar();

render(
  <LocationProvider scope={import.meta.env.BASE_URL}>
    <NavSlotProvider>
      <App />
    </NavSlotProvider>
  </LocationProvider>,
  document.getElementById('app')!
);
