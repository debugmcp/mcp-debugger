/**
 * Complete JavaScript Debugging Test
 * 
 * This script tests all JavaScript debugging features:
 * - Breakpoints
 * - Stack traces
 * - Variable inspection
 * - Expression evaluation
 * - Continue/Step operations
 */

// Test data
const testData = {
  name: "JavaScript Debugging",
  version: "1.0.0",
  features: ["breakpoints", "stack traces", "variables"]
};

// Function to test stack depth
function deepFunction(level) {
  if (level > 0) {
    return deepFunction(level - 1);
  } else {
    const localVar = "Bottom of stack";
    console.log("At bottom of stack"); // Line 24 - good for breakpoint
    return localVar;
  }
}

// Test function with variables
function testVariables() {
  const number = 42;
  const string = "Hello, Debugger!";
  const array = [1, 2, 3, 4, 5];
  const object = { a: 1, b: 2, nested: { c: 3 } };
  
  console.log("Testing variables"); // Line 37 - good for breakpoint
  
  // Modify variables to test expression evaluation
  const result = number * 2;
  return result;
}

// Main execution
async function main() {
  console.log("Starting JavaScript debugging test...");
  console.log("Test data:", testData);
  
  // Test 1: Stack trace depth
  console.log("\n=== Test 1: Stack Trace ===");
  const stackResult = deepFunction(3);
  console.log("Stack result:", stackResult);
  
  // Test 2: Variable inspection
  console.log("\n=== Test 2: Variable Inspection ===");
  const varResult = testVariables();
  console.log("Variable test result:", varResult);
  
  console.log("\n=== All tests complete! ===");
}

// Run the tests
main().catch(err => {
  console.error("Error in test:", err);
  process.exit(1);
});
