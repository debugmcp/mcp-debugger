// Long-running loop for pause/attach testing (issue #325).
// Compile: g++ -gdwarf-4 -O0 -o pause_test pause_test.cpp
#include <chrono>
#include <iostream>
#include <thread>

int main() {
    long long counter = 0;
    std::cout << "PAUSE_TEST_START" << std::endl;
    while (true) {
        counter++;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        if (counter % 20 == 0) {
            std::cout << "tick " << counter << std::endl;
        }
    }
    return 0;
}
