//! Simple Rust hello world example for debugging
//! 
//! This example demonstrates:
//! - Basic Rust program structure
//! - Variable inspection
//! - Stepping through code
//! - Breakpoint handling

fn main() {
    println!("Hello, MCP Debugger!");
    
    // Variables for inspection
    let name = "Rust";
    let version = 1.75;
    let is_awesome = true;
    
    // Simple calculation
    let result = calculate_sum(5, 10);
    println!("Sum of 5 and 10 is: {}", result);
    
    // Vector for collection inspection
    let mut numbers = vec![1, 2, 3, 4, 5];
    numbers.push(6);
    
    // String manipulation
    let message = format!("Language: {}, Version: {}", name, version);
    println!("{}", message);
    
    // Conditional logic
    if is_awesome {
        println!("Rust is awesome!");
    }
    
    // Loop for stepping
    for i in 0..3 {
        println!("Iteration: {}", i);
    }
}

fn calculate_sum(a: i32, b: i32) -> i32 {
    // Set a breakpoint here to inspect parameters
    let sum = a + b;
    sum
}
