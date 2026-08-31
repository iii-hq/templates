// The click-streamer worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/streaming

// --- Ch. 5 | click-streamer::broadcast ---
// import { registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "click-streamer",
// });
// const logger = new Logger();
//
// worker.registerFunction(
//   "click-streamer::broadcast",
//   async (data: { code: string; clicked_at: string }) => {
//     await worker.trigger({
//       function_id: "stream::set",
//       payload: {
//         stream_name: "clicks",
//         group_id: "all",
//         item_id: `${data.code}-${data.clicked_at}`,
//         data,
//       },
//     });
//     return { streamed: true };
//   },
// );
//
// worker.registerTrigger({
//   type: "subscribe",
//   function_id: "click-streamer::broadcast",
//   config: { topic: "link.clicked" },
// });
//
// logger.info("click-streamer ready");
