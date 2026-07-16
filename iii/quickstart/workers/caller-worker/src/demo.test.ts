import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoJob } from './demo.js';

test('creates an HTTP job ready for queue processing', () => {
  assert.deepEqual(
    createDemoJob('hello', 'http', 'fixed-id', '2026-07-16T12:00:00.000Z'),
    {
      job_id: 'fixed-id',
      message: 'hello',
      source: 'http',
      status: 'queued',
      steps: ['http', 'state'],
      created_at: '2026-07-16T12:00:00.000Z',
      updated_at: '2026-07-16T12:00:00.000Z',
    },
  );
});

test('records cron as the source of a scheduled job', () => {
  const job = createDemoJob(
    'scheduled proof',
    'cron',
    'cron-id',
    '2026-07-16T12:00:30.000Z',
  );

  assert.equal(job.source, 'cron');
  assert.deepEqual(job.steps, ['cron', 'state']);
});
