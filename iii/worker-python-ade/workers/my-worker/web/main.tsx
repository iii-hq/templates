// Public page entry, served at /my-worker by the http worker.
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { httpClient } from './client'

createRoot(document.getElementById('root') as HTMLElement).render(<App client={httpClient('/my-worker/api')} />)
