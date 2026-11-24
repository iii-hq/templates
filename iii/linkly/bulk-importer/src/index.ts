// The bulk-importer worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/channels

// --- Ch. 6 | bulk-importer::import_csv ---
// import { registerWorker, type InputStream } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "bulk-importer",
// });
// const logger = new Logger();
//
// worker.registerFunction("bulk-importer::import_csv", async (input: { csv: InputStream }) => {
//   let imported = 0;
//   let skipped = 0;
//   let header = true;
//   // Read the stream one line at a time, as the uploader sends it.
//   for await (const row of input.csv.lines()) {
//     if (header) {
//       header = false; // skip the header row
//       continue;
//     }
//     // Split on the first comma only, so commas inside the URL survive.
//     const comma = row.indexOf(",");
//     if (comma === -1) continue;
//     const code = row.slice(0, comma).trim();
//     const url = row.slice(comma + 1).trim();
//     if (!url) continue;
//     try {
//       await worker.call({
//         function_id: "link::create",
//         payload: { code, url },
//       });
//       imported += 1;
//     } catch (err) {
//       // link::create refuses a taken code with its own error, "code `<code>`
//       // is already taken". Skip that row. Re-throw anything else (a timeout, a
//       // worker that is down) so a broken import fails loudly instead of
//       // counting rows it never created as "skipped".
//       if (!(err instanceof Error && err.message.endsWith("is already taken"))) throw err;
//       skipped += 1;
//       logger.warn("bulk import row skipped", { code, error: String(err) });
//     }
//   }
//   logger.info("bulk import complete", { imported, skipped });
//   return { imported, skipped };
// });
//
// logger.info("bulk-importer ready");
