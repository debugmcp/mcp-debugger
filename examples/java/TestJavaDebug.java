/**
 * Comprehensive test script for Java debugging
 */
public class TestJavaDebug {

    /**
     * Calculate factorial recursively
     */
    public static int factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    /**
     * Sum an array of numbers
     */
    public static int sumArray(int[] numbers) {
        int total = 0;
        for (int num : numbers) {
            total += num;
        }
        return total;
    }

    /**
     * Process data with multiple operations
     */
    public static int[] processData(int[] data) {
        int[] result = new int[data.length];
        for (int i = 0; i < data.length; i++) {
            int processed = data[i] * 2;
            result[i] = processed;
        }
        return result;
    }

    /**
     * Main entry point
     */
    public static void main(String[] args) {
        // Test variables
        int x = 10;
        int y = 20;
        int z = x + y;

        // Test factorial
        int factResult = factorial(5);
        System.out.println("Factorial of 5: " + factResult);

        // Test array operations
        int[] numbers = {1, 2, 3, 4, 5};
        int sumResult = sumArray(numbers);
        System.out.println("Sum of numbers: " + sumResult);

        // Test data processing
        int[] data = {10, 20, 30};
        int[] processed = processData(data);
        System.out.print("Processed data: [");
        for (int i = 0; i < processed.length; i++) {
            System.out.print(processed[i]);
            if (i < processed.length - 1) {
                System.out.print(", ");
            }
        }
        System.out.println("]");

        // Final computation
        int finalResult = z * factResult;
        System.out.println("Final result: " + finalResult);

        System.out.println("Script completed with result: " + finalResult);
    }
}
