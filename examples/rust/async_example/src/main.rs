//! Async Rust example with Tokio for debugging
//! 
//! This example demonstrates:
//! - Async/await debugging
//! - Tokio runtime inspection
//! - Future handling
//! - Concurrent task debugging

use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    println!("Starting async Rust example");
    
    // Simple async function call
    let result = fetch_data(1).await;
    println!("Fetched data: {}", result);
    
    // Multiple concurrent tasks
    let task1 = tokio::spawn(async_task(1));
    let task2 = tokio::spawn(async_task(2));
    let task3 = tokio::spawn(async_task(3));
    
    // Wait for all tasks
    let results = tokio::join!(task1, task2, task3);
    
    match results {
        (Ok(r1), Ok(r2), Ok(r3)) => {
            println!("Task results: {}, {}, {}", r1, r2, r3);
        }
        _ => println!("Some tasks failed"),
    }
    
    // Async loop
    for i in 0..3 {
        process_item(i).await;
    }
    
    println!("Async example completed");
}

async fn fetch_data(id: u32) -> String {
    // Set a breakpoint here to inspect async context
    println!("Fetching data for id: {}", id);
    sleep(Duration::from_millis(100)).await;
    format!("Data_{}", id)
}

async fn async_task(task_id: u32) -> u32 {
    println!("Task {} starting", task_id);
    
    // Simulate async work
    let delay = Duration::from_millis(task_id as u64 * 100);
    sleep(delay).await;
    
    println!("Task {} completed", task_id);
    task_id * 10
}

async fn process_item(item: u32) {
    println!("Processing item: {}", item);
    sleep(Duration::from_millis(50)).await;
    println!("Item {} processed", item);
}
