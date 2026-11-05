import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { HinweisProvider } from './komponenten/Hinweis';
import { DatenProvider } from './lib/daten';
import './styles.css';

// Service Worker für Offline-Betrieb und Benachrichtigungen. Neue Versionen werden still übernommen.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatenProvider>
      <HinweisProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </HinweisProvider>
    </DatenProvider>
  </StrictMode>
);
