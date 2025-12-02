
public class AttachTestProgram {
    public static void main(String[] args) {
        System.out.println("AttachTestProgram started - waiting for debugger...");

        int counter = 0;
        while (true) {
            counter++;
            System.out.println("Counter: " + counter);

            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                break;
            }

            // Breakpoint target line
            if (counter >= 5) {
                System.out.println("Reached counter threshold: " + counter);
            }
        }
    }
}
