// The click-streamer worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/streaming

// --- Ch. 5 | click-streamer::on-click ---
// import { ObserveRejection, registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "click-streamer",
// });
// const logger = new Logger();
//
// type Click = { id: number; code: string; clicked_at: string };
//
// // The live feed. Each call is one click, and the click it returns is what
// // every listener receives.
// const onClick = worker.registerFunction(
//   "click-streamer::on-click",
//   async (click: Click): Promise<Click> => ({
//     id: click.id,
//     code: click.code,
//     clicked_at: click.clicked_at,
//   }),
//   {
//     description: "Runs once per recorded click. Observers receive { id, code, clicked_at }.",
//     // Only click-streamer calls the feed. Any worker may observe it.
//     private: true,
//   },
// );
//
// // iii accepts every observer by default. Cap the listeners: a throw rejects
// // the new observer, and the worker that asked sees the error.
// const MAX_LISTENERS = 256;
// onClick.onObserverAdded(() => {
//   if (onClick.observers().length >= MAX_LISTENERS) {
//     throw new ObserveRejection(
//       "TOO_MANY_LISTENERS",
//       "click-streamer::on-click: too many listeners",
//     );
//   }
// });
//
// // Runs each time link::record_click runs, with the click it returned as `output`.
// worker.registerFunction("click-streamer::announce", async ({ output: click }: { output: Click }) => {
//   await worker.call({ function_id: "click-streamer::on-click", payload: click });
//   return null;
// });
// worker.observe(
//   { function_id: "link::record_click", capture: ["output"] },
//   "click-streamer::announce",
// );
//
// logger.info("click-streamer ready");
