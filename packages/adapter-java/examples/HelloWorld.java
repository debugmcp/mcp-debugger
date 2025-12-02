/**
 * Simple Hello World program for testing Java debug adapter
 */
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Starting Hello World program...");

        String message = "Hello, World!";
        int count = 0;

        for (int i = 0; i < 3; i++) {
            count += i;
            System.out.println("Iteration " + i + ": count = " + count);
        }

        System.out.println(message);
        System.out.println("Final count: " + count);
        System.out.println("Program complete!");
    }
}
