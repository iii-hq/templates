// ADE entry: the console loads dist/ui/page.js (built from this file) and
// calls setup(host). React and @iii-dev/console-ui come from its import map.
import type { Host } from '@iii-dev/console-ui'
import { WorkerPage } from './WorkerPage'

export default function setup(host: Host) {
  host.pages.register({
    id: 'my-worker',
    title: 'my-worker',
    render: ({ onRequestClose }) => <WorkerPage host={host} onClose={onRequestClose} />,
  })
}
