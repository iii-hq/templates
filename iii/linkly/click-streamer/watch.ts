// A terminal listener for the live click feed. Run it from this folder with:
//
//   npx tsx watch.ts
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/streaming

// --- Ch. 5 | watch ---
// import { registerWorker } from "iii-sdk";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "click-watcher",
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
