import { registerWorker } from "iii-sdk";

async function main() {
  const worker = await registerWorker({
    name: "my-worker",
  });

  await worker.registerFunction({
    name: "hello",
    handler: async ({ payload }) => {
      return { greeting: `hello, ${payload?.name ?? "world"}` };
    },
  });

  console.log("worker ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
