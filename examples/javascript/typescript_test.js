/**
 * TypeScript debugging test for MCP debugger
 * Tests source map resolution, breakpoints, and variable inspection
 */
// Class with methods for testing stepping
class Calculator {
    history = [];
    add(a, b) {
        const result = a + b; // Breakpoint 1: Line 18
        this.history.push(result);
        return result;
    }
    multiply(a, b) {
        const result = a * b; // Breakpoint 2: Line 24
        this.history.push(result);
        return result;
    }
    getHistory() {
        return this.history;
    }
}
// Generic function for testing generic type handling
function swap(a, b) {
    console.log(`Before swap: a=${a}, b=${b}`);
    const temp = a; // Breakpoint 3: Line 37
    const swapped = [b, temp];
    console.log(`After swap: a=${swapped[0]}, b=${swapped[1]}`);
    return swapped;
}
// Async function for testing async debugging
async function fetchData(id) {
    console.log(`Fetching data for id: ${id}`);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    const person = {
        name: `Person ${id}`,
        age: 25 + id,
        email: `person${id}@example.com`
    };
    return person;
}
// Main function to orchestrate the tests
async function main() {
    console.log("Starting TypeScript debugging test...\n");
    // Test 1: Class instances and methods
    console.log("Test 1: Calculator class");
    const calc = new Calculator();
    const sum = calc.add(10, 20); // Breakpoint 5: Line 77
    const product = calc.multiply(5, 6);
    console.log(`Sum: ${sum}, Product: ${product}`);
    console.log(`History: ${calc.getHistory()}\n`);
    // Test 2: Generic functions
    console.log("Test 2: Generic swap function");
    const [x, y] = swap(100, 200);
    const [str1, str2] = swap("hello", "world");
    console.log(`Numbers swapped: ${x}, ${y}`);
    console.log(`Strings swapped: ${str1}, ${str2}\n`);
    // Test 3: Async operations
    console.log("Test 3: Async operations");
    const person1 = await fetchData(1);
    const person2 = await fetchData(2);
    console.log(`Fetched persons:`, person1, person2, '\n');
    // Test 4: Complex data structures
    console.log("Test 4: Complex data structures");
    const todos = [
        {
            id: 1,
            title: "Test debugging",
            status: "pending",
            tags: ["testing", "development"],
            metadata: {
                priority: "high",
                assignee: "developer",
                createdAt: new Date().toISOString()
            }
        },
        {
            id: 2,
            title: "Write documentation",
            status: "completed",
            tags: ["documentation"],
            metadata: {
                priority: "medium",
                completedAt: new Date().toISOString()
            }
        }
    ];
    // Process todos - good place for breakpoint
    for (const todo of todos) { // Breakpoint 6: Line 122
        console.log(`Todo ${todo.id}: ${todo.title} (${todo.status})`);
        console.log(`  Tags: ${todo.tags.join(", ")}`);
        console.log(`  Metadata:`, todo.metadata);
    }
    // Test 5: Error handling (for stack trace testing)
    try {
        throwTestError();
    }
    catch (error) {
        console.error("Caught error:", error); // Breakpoint 7: Line 132
    }
    console.log("\nTypeScript debugging test completed!");
}
function throwTestError() {
    throw new Error("This is a test error for stack trace inspection");
}
// Run the main function
main().catch(console.error);
export {};
//# sourceMappingURL=typescript_test.js.map