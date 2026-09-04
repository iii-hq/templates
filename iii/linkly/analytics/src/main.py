# The analytics worker for Linkly.
#
# Uncomment the block for the chapter you are on.
#
# Docs: https://iii.dev/docs/next/tutorials/linkly/durable-execution

# --- Ch. 4 | analytics::on_link_created ---
# import os
# import time
# from datetime import datetime, timezone
#
# from iii import register_worker, InitOptions
# from iii_helpers.observability import Logger
#
# worker = register_worker(
#     os.environ.get("III_URL", "ws://localhost:49134"),
#     InitOptions(worker_name="analytics"),
# )
# logger = Logger()
#
# DB = "analytics"
#
# def ensure_schema() -> None:
#     """The analytics worker owns its own table, in its own database.
#
#     The database worker may register a moment after analytics, so retry until it
#     answers instead of crashing on the first call.
#     """
#     for attempt in range(1, 31):
#         try:
#             worker.trigger(
#                 {
#                     "function_id": "database::execute",
#                     "payload": {
#                         "db": DB,
#                         "sql": "CREATE TABLE IF NOT EXISTS daily_link_counts (day TEXT PRIMARY KEY, count INTEGER NOT NULL)",
#                     },
#                 }
#             )
#             return
#         except Exception:
#             if attempt >= 30:
#                 raise
#             time.sleep(1)
#
# def on_link_created(data: dict) -> dict:
#     """Runs whenever link publishes `link.created`. Counts links per day."""
#     day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
#     worker.trigger(
#         {
#             "function_id": "database::execute",
#             "payload": {
#                 "db": DB,
#                 "sql": "INSERT INTO daily_link_counts (day, count) VALUES (?, 1) "
#                 "ON CONFLICT(day) DO UPDATE SET count = count + 1",
#                 "params": [day],
#             },
#         }
#     )
#     logger.info(f"counted new link {data.get('code')} for {day}")
#     return {"ok": True}
#
# ensure_schema()
#
# worker.register_function("analytics::on_link_created", on_link_created)
# worker.register_trigger(
#     {
#         "type": "subscribe",
#         "function_id": "analytics::on_link_created",
#         "config": {"topic": "link.created"},
#     }
# )
#
# print("Analytics worker started")
