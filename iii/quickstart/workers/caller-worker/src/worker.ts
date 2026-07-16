import { registerWorker } from 'iii-sdk';
import { Logger } from '@iii-dev/helpers/observability';

import { createDemoJob, type DemoJob, type DemoSource } from './demo.js';

const worker = registerWorker(process.env.III_URL ?? 'ws://localhost:49134');
const logger = new Logger();

const DEMO_SCOPE = 'worker-demo';
const DEMO_META_SCOPE = 'worker-demo-meta';
const DEMO_QUEUE = 'worker-demo.jobs';
const DEMO_TOPIC = 'worker-demo.completed';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

type HttpRequest = {
  body?: { message?: unknown };
  path_params?: Record<string, string>;
};

async function saveJob(job: DemoJob): Promise<DemoJob> {
  await worker.trigger({
    function_id: 'state::set',
    payload: { scope: DEMO_SCOPE, key: job.job_id, value: job },
  });
  return job;
}

async function getJob(jobId: string): Promise<DemoJob | null> {
  return worker.trigger<
    { scope: string; key: string },
    DemoJob | null
  >({
    function_id: 'state::get',
    payload: { scope: DEMO_SCOPE, key: jobId },
  });
}

async function enqueueDemoJob(
  message: string,
  source: DemoSource,
): Promise<DemoJob> {
  const job = await saveJob(createDemoJob(message, source));

  await worker.trigger({
    function_id: 'iii::durable::publish',
    payload: { queue: DEMO_QUEUE, data: job },
  });

  logger.info('Demo job queued', { job_id: job.job_id, source });
  return job;
}

worker.registerFunction(
  'math::add_two_numbers',
  async (payload: { a: number; b: number }) => {
    logger.info('math::add_two_numbers called in TypeScript', payload);

    const result = await worker.trigger<
      { a: number; b: number },
      { c: number; running_total?: number }
    >({
      function_id: 'math::add',
      payload,
    });

    return {
      ...result,
      success:
        "You've connected two workers and they're interoperating seamlessly, now let's add a few more workers to expand this project's functionality.",
    };
  },
);

worker.registerFunction('demo::process', async (job: DemoJob) => {
  const processed = await saveJob({
    ...job,
    status: 'processed',
    steps: [...job.steps, 'queue'],
    updated_at: new Date().toISOString(),
  });

  logger.info('Demo job processed from queue', { job_id: job.job_id });
  await worker.trigger({
    function_id: 'publish',
    payload: { topic: DEMO_TOPIC, data: processed },
  });

  return { job_id: job.job_id };
});

worker.registerTrigger({
  type: 'durable:subscriber',
  function_id: 'demo::process',
  config: { queue: DEMO_QUEUE, max_retries: 3, backoff_ms: 250 },
});

worker.registerFunction('demo::on-completed', async (job: DemoJob) => {
  const completed = await saveJob({
    ...job,
    status: 'completed',
    steps: [...job.steps, 'pubsub'],
    updated_at: new Date().toISOString(),
  });

  logger.info('Demo completion received from pubsub', {
    job_id: completed.job_id,
  });
  return { job_id: completed.job_id };
});

worker.registerTrigger({
  type: 'subscribe',
  function_id: 'demo::on-completed',
  config: { topic: DEMO_TOPIC },
});

worker.registerFunction('demo::http-create', async (request: HttpRequest) => {
  const rawMessage = request.body?.message;
  const message =
    typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage.trim()
      : 'manual worker demo';
  const job = await enqueueDemoJob(message, 'http');

  return {
    status_code: 202,
    headers: JSON_HEADERS,
    body: {
      job_id: job.job_id,
      status: job.status,
      check_url: `/worker-demo/${job.job_id}`,
    },
  };
});

worker.registerTrigger({
  type: 'http',
  function_id: 'demo::http-create',
  config: { api_path: '/worker-demo', http_method: 'POST' },
});

worker.registerFunction('demo::http-status', async (request: HttpRequest) => {
  const jobId = request.path_params?.job_id;
  if (!jobId) {
    return {
      status_code: 400,
      headers: JSON_HEADERS,
      body: { error: 'job_id is required' },
    };
  }

  const job = await getJob(jobId);
  return job
    ? { status_code: 200, headers: JSON_HEADERS, body: job }
    : {
        status_code: 404,
        headers: JSON_HEADERS,
        body: { error: 'job not found', job_id: jobId },
      };
});

worker.registerTrigger({
  type: 'http',
  function_id: 'demo::http-status',
  config: { api_path: '/worker-demo/:job_id', http_method: 'GET' },
});

worker.registerFunction('demo::cron', async () => {
  const job = await enqueueDemoJob('automatic cron proof', 'cron');
  await worker.trigger({
    function_id: 'state::set',
    payload: {
      scope: DEMO_META_SCOPE,
      key: 'last-cron-job',
      value: job.job_id,
    },
  });

  logger.info('Cron created a demo job', { job_id: job.job_id });
  return { job_id: job.job_id };
});

worker.registerTrigger({
  type: 'cron',
  function_id: 'demo::cron',
  config: { expression: '*/30 * * * * *' },
});

worker.registerFunction('demo::http-latest-cron', async () => {
  const jobId = await worker.trigger<
    { scope: string; key: string },
    string | null
  >({
    function_id: 'state::get',
    payload: { scope: DEMO_META_SCOPE, key: 'last-cron-job' },
  });
  const job = jobId ? await getJob(jobId) : null;

  return job
    ? { status_code: 200, headers: JSON_HEADERS, body: job }
    : {
        status_code: 404,
        headers: JSON_HEADERS,
        body: { error: 'cron has not created a job yet' },
      };
});

worker.registerTrigger({
  type: 'http',
  function_id: 'demo::http-latest-cron',
  config: { api_path: '/worker-demo-cron/latest', http_method: 'GET' },
});

console.log('Caller worker started - math and all-workers demo are ready');
