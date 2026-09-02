// The link worker for Linkly.
//
// This file is a starting point. You build the worker as the tutorial goes: an
// agent writes the functions and triggers each chapter asks for, into this file
// and into the new workers you add alongside it.
//
// Ch. 1 asks for link::create and link::resolve, plus the http::create and
// http::redirect triggers that expose them as POST /links and GET /s/:code.
//
// Docs: https://iii.dev/docs/next/tutorials/linkly/foundations

import { registerWorker } from "iii-sdk";
import { Logger } from "@iii-dev/helpers/observability";

const worker = registerWorker(process.env.III_URL ?? "ws://localhost:49134", {
  workerName: "link",
});
const logger = new Logger();

logger.info("link worker ready");
