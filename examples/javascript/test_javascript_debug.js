#!/usr/bin/env node
/**
 * Comprehensive test script for JavaScript debugging
 */

function factorial(n) {
    // Calculate factorial recursively
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

function sumList(numbers) {
    // Sum an array of numbers
    let total = 0;
    for (const num of numbers) {
        total += num;
    }
    return total;
}

function processData(data) {
    // Process some data with multiple operations
    const result = [];
    for (const item of data) {
        const processed = item * 2;
        result.push(processed);
    }
    return result;
}

function main() {
    // Test variables
    const x = 10;
    const y = 20;
    const z = x + y;
    
    // Test factorial
    const factResult = factorial(5);
    console.log(`Factorial of 5: ${factResult}`);
    
    // Test array operations
    const numbers = [1, 2, 3, 4, 5];
    const sumResult = sumList(numbers);
    console.log(`Sum of numbers: ${sumResult}`);
    
    // Test data processing
    const data = [10, 20, 30];
    const processed = processData(data);
    console.log(`Processed data: ${processed}`);
    
    // Final computation
    const final = z * factResult;
    console.log(`Final result: ${final}`);
    
    return final;
}

// Entry point
const result = main();
console.log(`Script completed with result: ${result}`);
