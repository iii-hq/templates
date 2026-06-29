use iii_sdk::{register_worker, RegisterFunction};
use serde_json::Value;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = std::env::var("III_URL")
        .unwrap_or_else(|_| "ws://localhost:49134".into());
    let iii = register_worker(&url, Default::default());

    iii.register_function(
        "compute-worker::compute",
        RegisterFunction::new_async(|input: Value| async move {
            let n = input.get("n").and_then(|v| v.as_u64()).unwrap_or(10);
            tokio::time::sleep(Duration::from_millis(100)).await;

            Ok::<_, iii_sdk::errors::Error>(serde_json::json!({
                "result": n * 2,
                "input": n,
                "source": "compute-worker"
            }))
        }),
    );

    println!("Compute worker started - listening for calls");

    tokio::signal::ctrl_c().await?;
    println!("Shutting down");
    Ok(())
}
