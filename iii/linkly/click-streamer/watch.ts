// A terminal listener for the live click feed. Run it from this folder with:
//
//   npm install && npx tsx watch.ts
//
// It is a plain script, not a Compose container, so it does not get the
// project's engine URL and namespace for free. It reads them from III_URL and
// III_NAMESPACE; the defaults match the `engine.url` and `namespace` that
// worker-compose.yaml ships with. If you changed either, pass them:
//
//   III_URL=ws://127.0.0.1:<port> III_NAMESPACE=<namespace> npx tsx watch.ts
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/streaming

// --- Ch. 5 | watch ---
// import { registerWorker } from "iii-sdk";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://127.0.0.1:49134", {
//   workerName: "click-watcher",
//   // Join the project's namespace: click-streamer registered the
//   // click-streamer::click trigger type there, and link::click_summary lives
//   // there too. From another namespace the binding is parked and never fires.
//   namespace: process.env.III_NAMESPACE || "default",
// });
//
// type Click = { id: number; code: string; clicked_at: string };
//
// worker.registerFunction("click-watcher::print", async (click: Click) => {
//   console.log(`click #${click.id}: ${click.code} at ${click.clicked_at}`);
//   return null;
// });
//
// // Bind first, then read the total, so no click falls between the two.
// worker.registerTrigger({
//   type: "click-streamer::click",
//   function_id: "click-watcher::print",
//   config: {},
// });
//
// const summary = await worker.trigger<Record<string, never>, { total: number; last_id: number }>({
//   function_id: "link::click_summary",
//   payload: {},
// });
// console.log(`watching clicks, ${summary.total} recorded so far`);
