import { registerWorker } from 'iii-sdk';
import { buildGreeting } from './greet.js';

const GREET_REQUEST = {
  type: 'object',
  properties: { name: { type: 'string', description: 'Who to greet' } },
  required: ['name'],
};
const GREET_RESPONSE = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
};

const worker = registerWorker(
  process.env.III_URL ?? 'ws://localhost:49134',
  { workerName: 'hello-node' },
);

worker.registerFunction(
  'hello-node::greet',
  async (payload: { name: string }) => buildGreeting(payload.name ?? 'World'),
  { description: 'Return a greeting for `name`.', request_format: GREET_REQUEST, response_format: GREET_RESPONSE },
);

console.log('hello-node started - listening for calls');
