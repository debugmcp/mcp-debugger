/** Long-running program for testing pause_execution. */
public class PauseTest {
    public static void main(String[] args) throws InterruptedException {
        int counter = 0;
        while (true) {
            counter++;
            Thread.sleep(500);
        }
    }
}
