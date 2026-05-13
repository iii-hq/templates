use iii_sdk::register_worker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let worker = register_worker("my-worker").await?;

    worker
        .register_function("hello", |payload: serde_json::Value| async move {
            let name = payload
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("world");
            Ok(serde_json::json!({ "greeting": format!("hello, {name}") }))
        })
        .await?;

    println!("worker ready");
    worker.run_forever().await?;
    Ok(())
}
