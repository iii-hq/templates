import { registerWorker } from 'iii-sdk';

const engineWsUrl = process.env.III_URL ?? 'ws://localhost:49134';

const iii = registerWorker(engineWsUrl, {
  workerName: 'my-worker',
});

iii.registerFunction('myWorker::hey', async (data: { name?: string }) => ({
  greeting: `hey, ${data?.name ?? 'world'}`,
}));

console.info('worker ready', { engineWsUrl });
