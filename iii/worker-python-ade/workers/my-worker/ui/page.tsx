// ADE entry: the console loads dist/ui/page.js (built from this file) and
// calls setup(host). React and @iii-dev/console-ui come from its import map.
import type { Host } from '@iii-dev/console-ui'
import { App } from './App'
import { hostClient } from './client'

export default function setup(host: Host) {
  const client = hostClient(host)
  host.pages.register({
    id: 'my-worker',
    title: 'my-worker',
    render: () => <App client={client} />,
  })
}
