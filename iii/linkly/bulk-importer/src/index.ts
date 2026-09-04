// The bulk-importer worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/channels

// --- Ch. 6 | bulk-importer::import_csv ---
// import { registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "bulk-importer",
// });
// const logger = new Logger();
//
// worker.registerFunction("bulk-importer::import_csv", async (input) => {
//   const chunks: Buffer[] = [];
//   for await (const chunk of input.reader.stream) {
//     chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
//   }
//   const csv = Buffer.concat(chunks).toString("utf-8");
//   const rows = csv.trim().split("\n").slice(1); // skip the header row
//
//   let imported = 0;
//   let skipped = 0;
//   for (const row of rows) {
//     // Split on the first comma only, so commas inside the URL survive.
//     const comma = row.indexOf(",");
//     if (comma === -1) continue;
//     const code = row.slice(0, comma).trim();
//     const url = row.slice(comma + 1).trim();
//     if (!url) continue;
//     try {
//       await worker.trigger({
//         function_id: "link::create",
//         payload: { code, url },
//       });
//       imported += 1;
//     } catch (err) {
//       // Skip a row the application rejects (a code already taken). Re-throw
//       // anything else (a timeout, a worker that is down) so a broken import
//       // fails loudly instead of counting rows it never created as "skipped".
//       if (!String(err).includes("already taken")) throw err;
//       skipped += 1;
//       logger.warn("bulk import row skipped", { code, error: String(err) });
//     }
//   }
//   logger.info("bulk import complete", { imported, skipped });
//   return { imported, skipped };
// });
//
// logger.info("bulk-importer ready");
