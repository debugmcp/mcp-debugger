// Simple C++ example for mcp-debugger smoke tests (issue #325).
// Compile: g++ -gdwarf-4 -O0 -o hello_world hello_world.cpp
#include <iostream>
#include <string>
#include <vector>

// Function-breakpoint target: set a function breakpoint on "compute_answer".
int compute_answer(int base, int factor) {
    int result = base * factor;
    return result + 2;
}

int main() {
    int count = 10;
    std::string greeting = "Hello from C++";  // asserted verbatim by tests/e2e/mcp-server-smoke-cpp.test.ts; line numbers here are breakpoint targets -- do not shift
    std::vector<int> values = {1, 2, 3};
    int answer = compute_answer(count, 4);
    std::cout << "CPP_DEBUG_MARKER: " << greeting << " answer=" << answer << std::endl;
    std::cout << "values has " << values.size() << " elements" << std::endl;
    return 0;
}
