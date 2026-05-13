import asyncio

from iii import register_worker


async def main() -> None:
    worker = await register_worker(name="my-worker")

    @worker.function(name="hello")
    async def hello(payload: dict) -> dict:
        return {"greeting": f"hello, {payload.get('name', 'world')}"}

    print("worker ready")
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
