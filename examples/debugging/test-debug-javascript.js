#!/usr/bin/env node
/**
 * Test script for debugging with MCP debugger.
 */

function calculateProduct(a, b) {
    // Calculate product of two numbers
    const result = a * b;
    console.log(`Product of ${a} and ${b} is ${result}`);
    return result;
}

function processArray(items) {
    // Process an array of items
    let sum = 0;
    for (let i = 0; i < items.length; i++) {
        console.log(`Processing item ${i}: ${items[i]}`);
        sum += items[i];
    }
    return sum;
}

function fibonacci(n) {
    // Calculate fibonacci number
    if (n <= 1) {
        return n;
    }
    const result = fibonacci(n - 1) + fibonacci(n - 2);
    return result;
}

function main() {
    console.log("Starting JavaScript debug test...");
    
    // Test simple calculation
    const x = 15;
    const y = 3;
    const product = calculateProduct(x, y);
    
    // Test array processing
    const numbers = [10, 20, 30, 40, 50];
    const arraySum = processArray(numbers);
    
    // Test recursive function
    const fibNumber = 6;
    const fibResult = fibonacci(fibNumber);
    console.log(`Fibonacci(${fibNumber}) = ${fibResult}`);
    
    // Test object manipulation
    const testObject = {
        name: "Debug Test",
        value: product + arraySum,
        fib: fibResult
    };
    
    console.log("Test object:", testObject);
    
    const finalResult = testObject.value + testObject.fib;
    console.log(`Debug test complete: ${finalResult}`);
    
    return finalResult;
}

// Run the main function
const result = main();
console.log(`Program finished with result: ${result}`);
