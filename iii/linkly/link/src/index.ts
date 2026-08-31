// The link worker for Linkly.
//
// Every block below is one step of the tutorial, tagged with its chapter.
// Uncomment the blocks for the chapter you are on. Where a chapter revises a
// function you already enabled, comment the earlier version out again.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/foundations

// --- Ch. 1 | prelude ---
// import { registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "link",
// });
// const logger = new Logger();
//
// const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
//
// function makeCode(): string {
//   let s = "";
//   for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
//   return s;
// }

// --- Ch. 3 | prelude (replaces Ch. 1) ---
// import { registerWorker } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "link",
// });
// const logger = new Logger();
//
// const DB = "primary"; // Matches the database name in worker-compose.yaml
//
// const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
//
// function makeCode(): string {
//   let s = "";
//   for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
//   return s;
// }

// --- Ch. 4 | prelude (replaces Ch. 3) ---
// import { registerWorker, TriggerAction } from "iii-sdk";
// import { Logger } from "@iii-dev/helpers/observability";
//
// const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
//   workerName: "link",
// });
// const logger = new Logger();
//
// const DB = "primary"; // Matches the database name in worker-compose.yaml
//
// const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
//
// function makeCode(): string {
//   let s = "";
//   for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
//   return s;
// }

// --- Ch. 1 | link::create ---
// worker.registerFunction("link::create", async (payload: { url: string; code?: string }) => {
//   const code = payload.code ?? makeCode();
//   // Store an absolute URL so the redirect's Location header is absolute, not
//   // resolved relative to /s/:code.
//   const url = /^https?:\/\//i.test(payload.url) ? payload.url : `https://${payload.url}`;
//   await worker.trigger({
//     function_id: "state::set",
//     payload: { scope: "links", key: code, value: { url } },
//   });
//   logger.info("link created", { code, url });
//   return { code, url };
// });

// --- Ch. 3 | link::create (replaces Ch. 1) ---
// worker.registerFunction("link::create", async (payload: { url: string; code?: string }) => {
//   const code = payload.code ?? makeCode();
//   const url = /^https?:\/\//i.test(payload.url) ? payload.url : `https://${payload.url}`;
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: {
//       db: DB,
//       sql: "INSERT INTO links (code, url, created_at) VALUES (?, ?, ?)",
//       params: [code, url, new Date().toISOString()],
//     },
//   });
//   await worker.trigger({
//     function_id: "state::set",
//     payload: { scope: "links", key: code, value: { url } },
//   });
//   logger.info("link created", { code, url });
//   return { code, url };
// });

// --- Ch. 4 | link::create (replaces Ch. 3) ---
// worker.registerFunction("link::create", async (payload: { url: string; code?: string }) => {
//   const code = payload.code ?? makeCode();
//   const url = /^https?:\/\//i.test(payload.url) ? payload.url : `https://${payload.url}`;
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: {
//       db: DB,
//       sql: "INSERT INTO links (code, url, created_at) VALUES (?, ?, ?)",
//       params: [code, url, new Date().toISOString()],
//     },
//   });
//   await worker.trigger({
//     function_id: "state::set",
//     payload: { scope: "links", key: code, value: { url } },
//   });
//   await worker.trigger({
//     function_id: "publish",
//     payload: { topic: "link.created", data: { code, url } },
//   });
//   logger.info("link created", { code, url });
//   return { code, url };
// });

// --- Ch. 1 | link::resolve ---
// worker.registerFunction("link::resolve", async (payload: { code: string }) => {
//   const stored = await worker.trigger<{ scope: string; key: string }, { url: string } | null>({
//     function_id: "state::get",
//     payload: { scope: "links", key: payload.code },
//   });
//   logger.info("link resolved", { code: payload.code, found: !!stored?.url });
//   return { url: stored?.url ?? null };
// });

// --- Ch. 1 | ready log ---
// logger.info("link worker ready");

// --- Ch. 3 | link::resolve (replaces Ch. 1) ---
// worker.registerFunction("link::resolve", async (payload: { code: string }) => {
//   const cached = await worker.trigger<{ scope: string; key: string }, { url: string } | null>({
//     function_id: "state::get",
//     payload: { scope: "links", key: payload.code },
//   });
//   if (cached) {
//     logger.info("link resolved", { code: payload.code, found: true });
//     return { url: cached.url };
//   }
//   const { rows } = await worker.trigger<
//     { db: string; sql: string; params: string[] },
//     { rows: Array<{ url: string }> }
//   >({
//     function_id: "database::query",
//     payload: { db: DB, sql: "SELECT url FROM links WHERE code = ?", params: [payload.code] },
//   });
//   const url = rows[0]?.url ?? null;
//   if (url) {
//     await worker.trigger({
//       function_id: "state::set",
//       payload: { scope: "links", key: payload.code, value: { url } },
//     });
//   }
//   logger.info("link resolved", { code: payload.code, found: !!url });
//   return { url };
// });

// --- Ch. 1 | http::create ---
// worker.registerFunction("http::create", async (req) => {
//   const { url, code } = req.body ?? {};
//   if (!url) {
//     return {
//       status_code: 400,
//       body: { error: 'missing "url"' },
//       headers: { "Content-Type": "application/json" },
//     };
//   }
//   const link = await worker.trigger<{ url: string; code?: string }, { code: string; url: string }>({
//     function_id: "link::create",
//     payload: { url, code },
//   });
//   return {
//     status_code: 201,
//     body: link,
//     headers: { "Content-Type": "application/json" },
//   };
// });

// --- Ch. 1 | POST /links ---
// worker.registerTrigger({
//   type: "http",
//   function_id: "http::create",
//   config: { api_path: "/links", http_method: "POST" },
// });

// --- Ch. 1 | http::redirect ---
// worker.registerFunction("http::redirect", async (req) => {
//   const code = req.path_params.code;
//   const { url } = await worker.trigger<{ code: string }, { url: string | null }>({
//     function_id: "link::resolve",
//     payload: { code },
//   });
//   if (!url) {
//     return {
//       status_code: 404,
//       body: { error: "link not found" },
//       headers: { "Content-Type": "application/json" },
//     };
//   }
//   return { status_code: 302, headers: { Location: url } };
// });

// --- Ch. 1 | GET /s/:code ---
// worker.registerTrigger({
//   type: "http",
//   function_id: "http::redirect",
//   config: { api_path: "/s/:code", http_method: "GET" },
// });

// --- Ch. 3 | ensureSchema ---
// async function ensureSchema(): Promise<void> {
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: {
//       db: DB,
//       sql: "CREATE TABLE IF NOT EXISTS links (code TEXT PRIMARY KEY, url TEXT NOT NULL, created_at TEXT NOT NULL)",
//     },
//   });
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: {
//       db: DB,
//       sql: "CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, clicked_at TEXT NOT NULL)",
//     },
//   });
// }
//
// ensureSchema()
//   .then(() => logger.info("database: ready"))
//   .catch((err) => logger.error("database: schema init failed", { error: String(err) }));

// --- Ch. 3 | link::record_click ---
// worker.registerFunction(
//   "link::record_click",
//   async (payload: { code: string; clicked_at: string }) => {
//     await worker.trigger({
//       function_id: "database::execute",
//       payload: {
//         db: DB,
//         sql: "INSERT INTO clicks (code, clicked_at) VALUES (?, ?)",
//         params: [payload.code, payload.clicked_at],
//       },
//     });
//     return { recorded: true };
//   },
// );

// --- Ch. 5 | link::record_click (replaces Ch. 3) ---
// worker.registerFunction(
//   "link::record_click",
//   async (payload: { code: string; clicked_at: string }) => {
//     await worker.trigger({
//       function_id: "database::execute",
//       payload: {
//         db: DB,
//         sql: "INSERT INTO clicks (code, clicked_at) VALUES (?, ?)",
//         params: [payload.code, payload.clicked_at],
//       },
//     });
//     worker.trigger({
//       function_id: "publish",
//       payload: { topic: "link.clicked", data: payload },
//       action: TriggerAction.Void(),
//     });
//     return { recorded: true };
//   },
// );

// --- Ch. 3 | http::redirect (replaces Ch. 1) ---
// worker.registerFunction("http::redirect", async (req) => {
//   const code = req.path_params.code;
//   const { url } = await worker.trigger<{ code: string }, { url: string | null }>({
//     function_id: "link::resolve",
//     payload: { code },
//   });
//   if (!url) {
//     return {
//       status_code: 404,
//       body: { error: "link not found" },
//       headers: { "Content-Type": "application/json" },
//     };
//   }
//   // This Trigger is slow because it waits on link::record_click's completion, we'll move its work to a queue soon
//   await worker.trigger({
//     function_id: "link::record_click",
//     payload: { code, clicked_at: new Date().toISOString() },
//   });
//   return { status_code: 302, headers: { Location: url } };
// });

// --- Ch. 4 | http::redirect (replaces Ch. 3) ---
// worker.registerFunction("http::redirect", async (req) => {
//   const code = req.path_params.code;
//   const { url } = await worker.trigger<{ code: string }, { url: string | null }>({
//     function_id: "link::resolve",
//     payload: { code },
//   });
//   if (!url) {
//     return {
//       status_code: 404,
//       body: { error: "link not found" },
//       headers: { "Content-Type": "application/json" },
//     };
//   }
//   await worker.trigger({
//     function_id: "link::record_click",
//     payload: { code, clicked_at: new Date().toISOString() },
//     action: TriggerAction.Enqueue({ queue: "clicks" }),
//   });
//   return { status_code: 302, headers: { Location: url } };
// });

// --- Ch. 4 | link::update ---
// worker.registerFunction("link::update", async (payload: { code: string; url: string }) => {
//   const url = /^https?:\/\//i.test(payload.url) ? payload.url : `https://${payload.url}`;
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: {
//       db: DB,
//       sql: "UPDATE links SET url = ? WHERE code = ?",
//       params: [url, payload.code],
//     },
//   });
//   await worker.trigger({
//     function_id: "iii::durable::publish",
//     payload: { topic: "link.updated", data: { code: payload.code, url } },
//   });
//   return { code: payload.code, url };
// });

// --- Ch. 4 | http::update ---
// worker.registerFunction("http::update", async (req) => {
//   const code = req.path_params.code;
//   const url = req.body?.url;
//   if (!url) {
//     return {
//       status_code: 400,
//       body: { error: 'missing "url"' },
//       headers: { "Content-Type": "application/json" },
//     };
//   }
//   const link = await worker.trigger<{ code: string; url: string }, { code: string; url: string }>({
//     function_id: "link::update",
//     payload: { code, url },
//   });
//   return { status_code: 200, body: link, headers: { "Content-Type": "application/json" } };
// });

// --- Ch. 4 | PUT /links/:code ---
// worker.registerTrigger({
//   type: "http",
//   function_id: "http::update",
//   config: { api_path: "/links/:code", http_method: "PUT" },
// });

// --- Ch. 4 | link::on_link_updated ---
// worker.registerFunction("link::on_link_updated", async (data: { code: string; url: string }) => {
//   await worker.trigger({
//     function_id: "state::set",
//     payload: { scope: "links", key: data.code, value: { url: data.url } },
//   });
// });
//
// worker.registerTrigger({
//   type: "durable:subscriber",
//   function_id: "link::on_link_updated",
//   config: { topic: "link.updated" },
// });

// --- Ch. 7 | link::delete ---
// worker.registerFunction("link::delete", async (payload: { code: string }) => {
//   await worker.trigger({
//     function_id: "database::execute",
//     payload: { db: DB, sql: "DELETE FROM links WHERE code = ?", params: [payload.code] },
//   });
//   await worker.trigger({
//     function_id: "state::delete",
//     payload: { scope: "links", key: payload.code },
//   });
//   logger.info("link deleted", { code: payload.code });
//   return { deleted: true };
// });

// --- Ch. 7 | link::request_delete ---
// worker.registerFunction("link::request_delete", async (payload: { code: string }) => {
//   const { confirmed } = await worker.trigger<
//     { code: string; action: string },
//     { confirmed: boolean }
//   >({
//     function_id: "user::confirm_destructive_op",
//     payload: { code: payload.code, action: `delete link "${payload.code}"` },
//   });
//   if (!confirmed) {
//     return { deleted: false };
//   }
//   await worker.trigger({ function_id: "link::delete", payload: { code: payload.code } });
//   return { deleted: true };
// });
