// The CSV uploader for Linkly. It is a plain script, not a worker.
//
// Uncomment the block for the chapter you are on, then run:
//
//   node import-links.js
//
// It is not a Compose container, so it reads the project's engine URL and
// namespace from III_URL and III_NAMESPACE; the defaults match the `engine.url`
// and `namespace` that worker-compose.yaml ships with. If you changed either:
//
//   III_URL=ws://127.0.0.1:<port> III_NAMESPACE=<namespace> node import-links.js
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/channels

// --- Ch. 6 | import-links ---
// import { registerWorker } from "iii-sdk";
// import { createChannel } from "iii-sdk/helpers";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://127.0.0.1:49134", {
//   workerName: "uploader",
//   // bulk-importer::import_csv is registered in the project's namespace.
//   namespace: process.env.III_NAMESPACE || "default",
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
