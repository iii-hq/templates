// Standalone entry, served at http://127.0.0.1:3111/my-worker. The wrapper
// gives App the same [data-iii-ui] scope the ADE gives it.
import { createRoot } from 'react-dom/client'
import { App } from '../ui/App'
import { httpClient } from '../ui/client'

createRoot(document.getElementById('root') as HTMLElement).render(
  <div data-iii-ui="my-worker">
    <App client={httpClient('/my-worker/api')} />
  </div>,
)
