// Exception-filter fixture: one caught throw, optionally one uncaught (issue #325).
// Compile: g++ -gdwarf-4 -O0 -o throwing_example throwing_example.cpp
// Run with --crash to terminate via an uncaught std::runtime_error.
#include <iostream>
#include <stdexcept>
#include <string>

void throw_and_catch() {
    try {
        throw std::runtime_error("caught error");
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << std::endl;
    }
}

int main(int argc, char** argv) {
    throw_and_catch();
    if (argc > 1 && std::string(argv[1]) == "--crash") {
        throw std::runtime_error("uncaught error");
    }
    std::cout << "THROW_TEST_DONE" << std::endl;
    return 0;
}
