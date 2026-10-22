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
# SCHEMA = [
#     # One row per link. Delivery is at least once, so a redelivered event
#     # finds its row already there and changes nothing.
#     "CREATE TABLE IF NOT EXISTS link_events (code TEXT PRIMARY KEY, day TEXT NOT NULL)",
#     # The per-day counts are computed from those rows, never stored.
#     "CREATE VIEW IF NOT EXISTS daily_link_counts AS "
#     "SELECT day, COUNT(*) AS count FROM link_events GROUP BY day",
# ]
#
# def ensure_schema() -> None:
#     """The analytics worker owns its own table, in its own database.
#
#     The database worker may register a moment after analytics, so retry until it
#     answers instead of crashing on the first call.
#     """
#     for attempt in range(1, 31):
#         try:
#             for sql in SCHEMA:
#                 worker.trigger(
#                     {"function_id": "database::execute", "payload": {"db": DB, "sql": sql}}
#                 )
#             return
#         except Exception:
#             if attempt >= 30:
#                 raise
#             time.sleep(1)
#
# def on_link_created(data: dict) -> dict:
#     """Runs whenever link publishes `link.created`. Records the link's day."""
#     # The day the link was created (UTC), not the day this copy arrived.
#     created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
#     day = created_at.astimezone(timezone.utc).strftime("%Y-%m-%d")
#     worker.trigger(
#         {
#             "function_id": "database::execute",
#             "payload": {
#                 "db": DB,
#                 "sql": "INSERT INTO link_events (code, day) VALUES (?, ?) "
#                 "ON CONFLICT(code) DO NOTHING",
#                 "params": [data["code"], day],
#             },
#         }
#     )
#     logger.info(f"recorded new link {data['code']} for {day}")
#     return {"ok": True}
#
# ensure_schema()
#
# worker.register_function("analytics::on_link_created", on_link_created)
# worker.register_trigger(
#     {
#         "type": "durable:subscriber",
#         "function_id": "analytics::on_link_created",
#         "config": {"topic": "link.created"},
#     }
# )
#
# print("Analytics worker started")
