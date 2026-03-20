// Long-running program for testing pause_execution.
using System;
using System.Threading;

class PauseTest {
    static void Main() {
        int counter = 0;
        while (true) {
            counter++;
            Thread.Sleep(500);
        }
    }
}
