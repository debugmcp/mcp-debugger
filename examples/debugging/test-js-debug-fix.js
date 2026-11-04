// Simple test script for debugging: a plain breakpoint target
function testFunction() {
    const x = 10;
    const y = 20;
    const result = x + y;  // Set breakpoint here (line 5)
    console.log('Result:', result);
    return result;
}

// Call the function
const output = testFunction();
console.log('Final output:', output);
