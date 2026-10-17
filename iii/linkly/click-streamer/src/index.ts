// The click-streamer worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/streaming

// --- Ch. 5 | click-streamer::click ---
// import { registerWorker, TriggerAction } from "iii-sdk";
// import type { TriggerConfig } from "iii-sdk/trigger";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "click-streamer",
// });
// const logger = new Logger();
//
// type Click = { id: number; code: string; clicked_at: string };
// type ClickFilter = { code?: string };
//
// // Every function bound to click-streamer::click, keyed by trigger id. The cap
// // keeps a flood of listeners from growing it without limit.
// const MAX_LISTENERS = 256;
// const listeners = new Map<string, TriggerConfig<ClickFilter>>();
//
// worker.registerTriggerType<ClickFilter>(
//   {
//     id: "click-streamer::click",
//     description: "Fires after a click is recorded. Config: { code? }. Payload: { id, code, clicked_at }.",
//   },
//   {
//     async registerTrigger(binding) {
//       // Throwing rejects the binding, and the worker that asked sees the error.
//       const code = binding.config?.code;
//       if (code !== undefined && typeof code !== "string") {
//         throw new Error("click-streamer::click: code must be a string");
//       }
//       if (!listeners.has(binding.id) && listeners.size >= MAX_LISTENERS) {
//         throw new Error("click-streamer::click: too many listeners");
//       }
//       listeners.set(binding.id, binding);
//     },
//     async unregisterTrigger(binding) {
//       // Also called when the listening worker disconnects.
//       listeners.delete(binding.id);
//     },
//   },
// );
//
// worker.registerFunction("click-streamer::broadcast", async (click: Click) => {
//   // Copy the fields: the engine stamps bookkeeping fields such as
//   // _caller_worker_id on every delivery.
//   const event: Click = { id: click.id, code: click.code, clicked_at: click.clicked_at };
//   let delivered = 0;
//   for (const binding of listeners.values()) {
//     if (binding.config?.code && binding.config.code !== event.code) continue;
//     try {
//       await worker.trigger({
//         function_id: binding.function_id,
//         // Deliver where the listener registered, with its metadata.
//         namespace: binding.namespace,
//         metadata: binding.metadata,
//         payload: event,
//         action: TriggerAction.Void(),
//       });
//       delivered++;
//     } catch (err) {
//       logger.warn("click delivery failed", { trigger: binding.id, error: String(err) });
//     }
//   }
//   return { delivered };
// });
//
// logger.info("click-streamer ready");
