// The CSV uploader for Linkly. It is a plain script, not a worker.
//
// Uncomment the block for the chapter you are on, then run:
//
//   node import-links.js
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/channels

// --- Ch. 6 | import-links ---
// import { registerWorker } from "iii-sdk";
// import { createChannel } from "iii-sdk/helpers";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "uploader",
// });
//
// const csv = ["code,url", "mylink,https://iii.dev", "mydocslink,https://iii.dev/docs"].join("\n");
//
// const channel = await createChannel(worker);
// channel.writer.stream.write(Buffer.from(csv));
// channel.writer.stream.end();
//
// const result = await worker.trigger({
//   function_id: "bulk-importer::import_csv",
//   payload: { reader: channel.readerRef },
// });
// console.log(result);
//
// await worker.shutdown();
