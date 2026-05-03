import { render } from 'preact';
import { LocationProvider } from 'preact-iso';
import { App } from './app-native';
import { NavSlotProvider } from './components/NavSlot';
import { AuthGate } from './components/AuthGate';
import './app.css';
import { configureStatusBar } from './native';

configureStatusBar();

render(
  <LocationProvider scope={import.meta.env.BASE_URL}>
    <AuthGate>
      <NavSlotProvider>
        <App />
      </NavSlotProvider>
    </AuthGate>
  </LocationProvider>,
  document.getElementById('app')!
);
