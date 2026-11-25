// The CSV uploader for Linkly. It is a plain script, not a worker.
//
// Uncomment the block for the chapter you are on, then run:
//
//   node import-links.js
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/channels

// --- Ch. 6 | import-links ---
// import { InputStream, registerWorker } from "iii-sdk";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://127.0.0.1:49134", {
//   workerName: "uploader",
//   // The project's namespace, where bulk-importer::import_csv lives.
//   namespace: process.env.III_NAMESPACE || "default",
// });
//
// const csv = ["code,url", "mylink,https://iii.dev", "mydocslink,https://iii.dev/docs"].join("\n");
//
// const result = await worker.call({
//   function_id: "bulk-importer::import_csv",
//   payload: { csv: InputStream.from(csv) },
// });
// console.log(result);
//
// await worker.shutdown();
