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
//     // Each tab sends a unique session id and registers in its own
//     // `browser-<session>` namespace, so the functions two tabs register never
//     // collide. Granting only that namespace key keeps a tab out of `default`.
//     const session = input.query_params.session?.[0];
//     if (!session) {
//       throw new Error("missing session");
//     }
//     return {
//       allow_trigger_type_registration: false,
//       allow_function_registration: true,
//       namespaces: {
//         [`browser-${session}`]: ["ui::on_click", "user::confirm_destructive_op"],
//       },
//       context: { source: "browser" },
//     };
//   },
// );
//
// logger.info("auth worker ready");
