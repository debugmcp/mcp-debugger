// Line references below refer to original TypeScript source, not this transpiled file
/**
 * TypeScript debugging test for MCP debugger
 * Tests source map resolution, breakpoints, and variable inspection
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// Class with methods for testing stepping
var Calculator = /** @class */ (function () {
    function Calculator() {
        this.history = [];
    }
    Calculator.prototype.add = function (a, b) {
        var result = a + b; // Breakpoint 1: Line 18
        this.history.push(result);
        return result;
    };
    Calculator.prototype.multiply = function (a, b) {
        var result = a * b; // Breakpoint 2: Line 23
        this.history.push(result);
        return result;
    };
    Calculator.prototype.getHistory = function () {
        return this.history;
    };
    return Calculator;
}());
// Generic function for testing generic type handling
function swap(a, b) {
    console.log("Before swap: a=".concat(a, ", b=").concat(b));
    var temp = a; // Breakpoint 3: Line 36
    var swapped = [b, temp];
    console.log("After swap: a=".concat(swapped[0], ", b=").concat(swapped[1]));
    return swapped;
}
// Async function for testing async debugging
function fetchData(id) {
    return __awaiter(this, void 0, void 0, function () {
        var person;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Fetching data for id: ".concat(id));
                    // Simulate async operation
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 1:
                    // Simulate async operation
                    _a.sent();
                    person = {
                        name: "Person ".concat(id),
                        age: 25 + id,
                        email: "person".concat(id, "@example.com")
                    };
                    return [2 /*return*/, person];
            }
        });
    });
}
// Main function to orchestrate the tests
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var calc, sum, product, _a, x, y, _b, str1, str2, person1, person2, todos, _i, todos_1, todo;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("Starting TypeScript debugging test...\n");
                    // Test 1: Class instances and methods
                    console.log("Test 1: Calculator class");
                    calc = new Calculator();
                    sum = calc.add(10, 20);
                    product = calc.multiply(5, 6);
                    console.log("Sum: ".concat(sum, ", Product: ").concat(product));
                    console.log("History: ".concat(calc.getHistory(), "\n"));
                    // Test 2: Generic functions
                    console.log("Test 2: Generic swap function");
                    _a = swap(100, 200), x = _a[0], y = _a[1];
                    _b = swap("hello", "world"), str1 = _b[0], str2 = _b[1];
                    console.log("Numbers swapped: ".concat(x, ", ").concat(y));
                    console.log("Strings swapped: ".concat(str1, ", ").concat(str2, "\n"));
                    // Test 3: Async operations
                    console.log("Test 3: Async operations");
                    return [4 /*yield*/, fetchData(1)];
                case 1:
                    person1 = _c.sent();
                    return [4 /*yield*/, fetchData(2)];
                case 2:
                    person2 = _c.sent();
                    console.log("Fetched persons:", person1, person2, '\n');
                    // Test 4: Complex data structures
                    console.log("Test 4: Complex data structures");
                    todos = [
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
                    for (_i = 0, todos_1 = todos; _i < todos_1.length; _i++) { // Breakpoint 6: Line 119
                        todo = todos_1[_i];
                        console.log("Todo ".concat(todo.id, ": ").concat(todo.title, " (").concat(todo.status, ")"));
                        console.log("  Tags: ".concat(todo.tags.join(", ")));
                        console.log("  Metadata:", todo.metadata);
                    }
                    // Test 5: Error handling (for stack trace testing)
                    try {
                        throwTestError();
                    }
                    catch (error) {
                        console.error("Caught error:", error); // Breakpoint 7: Line 129
                    }
                    console.log("\nTypeScript debugging test completed!");
                    return [2 /*return*/];
            }
        });
    });
}
function throwTestError() {
    throw new Error("This is a test error for stack trace inspection");
}
// Run the main function
main().catch(console.error);
//# sourceMappingURL=typescript_test.js.map