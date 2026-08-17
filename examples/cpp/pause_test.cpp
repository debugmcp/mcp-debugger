// Long-running loop for pause/attach testing (issue #325).
// Compile: g++ -gdwarf-4 -O0 -o pause_test pause_test.cpp
#include <chrono>
#include <iostream>
#include <thread>
#ifdef __linux__
#include <sys/prctl.h>
#endif

int main() {
#ifdef __linux__
    // Yama ptrace_scope=1 only lets ancestors attach; the attach tests spawn
    // this process outside the debugger's process tree, so opt in to any tracer.
    prctl(PR_SET_PTRACER, PR_SET_PTRACER_ANY, 0, 0, 0);
#endif
    long long counter = 0;
    std::cout << "PAUSE_TEST_START" << std::endl;
    while (true) {
        counter++;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        if (counter % 20 == 0) {
            std::cout << "tick " << counter << std::endl;
        }
    }
    return 0;  // unreachable — the loop above runs until the process is paused/killed externally
}
