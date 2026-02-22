import { render } from 'preact';
import { LocationProvider } from 'preact-iso';
import { App } from './app';
import './app.css';

render(
  <LocationProvider scope={import.meta.env.BASE_URL}>
    <App />
  </LocationProvider>,
  document.getElementById('app')!
);
