import { render } from 'preact';
import { LocationProvider } from 'preact-iso';
import { App } from './app';
import './app.css';

// Detect standalone PWA mode (especially iOS)
const isStandalone =
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

if (isStandalone) {
  document.documentElement.classList.add('pwa-standalone');
}

render(
  <LocationProvider scope={import.meta.env.BASE_URL}>
    <App />
  </LocationProvider>,
  document.getElementById('app')!
);
