/**
 * Exception fixture for break-on-exceptions e2e tests.
 * Raises a caught IllegalStateException first (for the 'caught' filter),
 * then crashes with an uncaught RuntimeException.
 */
public class ThrowsTest {
    public static void main(String[] args) {
        try {
            throw new IllegalStateException("caught on purpose");
        } catch (IllegalStateException e) {
            System.out.println("caught: " + e.getMessage());
        }
        throw new RuntimeException("uncaught on purpose");
    }
}
