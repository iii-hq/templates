import { registerWorker } from 'iii-sdk';
import { Logger } from '@iii-dev/helpers/observability';

const worker = registerWorker(process.env.III_URL ?? 'ws://localhost:49134', {
  workerName: 'caller-worker',
});
const logger = new Logger();

worker.registerFunction(
  'math::add_two_numbers',
  async (payload: { a: number; b: number }) => {
    logger.info('math::add_two_numbers called in TypeScript', payload);

    const result = await worker.call<
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

// --- Uncomment after: iii call compose::add worker=http ---
// worker.registerFunction(
//   "http::add_two_numbers",
//   async (payload: { body: { a: number; b: number } }) => {
//     const result = await worker.call<
//       { a: number; b: number },
//       { c: number; running_total: number }
//     >({
//       function_id: "math::add_two_numbers",
//       payload: payload.body,
//     });
//     return {
//       status_code: 200,
//       body: { c: result.c, running_total: result.running_total },
//       headers: { "Content-Type": "application/json" },
//     };
//   },
// );
//
// worker.observe(
//   {
//     function_id: "http::on-request",
//     args: { method: "POST", path: "/math/add-two-numbers" },
//   },
//   "http::add_two_numbers",
// );

console.log('Caller worker started - listening for calls');
