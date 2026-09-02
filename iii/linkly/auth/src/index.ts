// The auth worker for Linkly.
//
// Uncomment the block for the chapter you are on.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/frontend

// --- Ch. 7 | auth::browser ---
// import { registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "auth",
// });
// const logger = new Logger();
//
// worker.registerFunction(
//   "auth::browser",
//   async (input: {
//     headers: Record<string, string>;
//     query_params: Record<string, string[]>;
//     ip_address: string;
//   }) => {
//     // Fail closed: no LINKLY_BROWSER_TOKEN set means no browser is admitted.
//     const expected = process.env.LINKLY_BROWSER_TOKEN;
//     const token = input.query_params.token?.[0];
//     if (!expected || token !== expected) {
//       throw new Error("unauthorized");
//     }
//     return {
//       allowed_functions: [],
//       forbidden_functions: [],
//       allow_trigger_type_registration: false,
//       allow_function_registration: true,
//       context: { source: "browser" },
//     };
//   },
// );
//
// logger.info("auth worker ready");
