/**
 * Helper class that is NOT loaded until EventRaceTest.main() references it.
 * A breakpoint set here before the class is loaded creates a ClassPrepareRequest.
 */
public class LateLoadedHelper {

    static String greet(String name) {
        String greeting = "Hello, " + name + "!";  // line 8 — breakpoint target
        return greeting;                             // line 9
    }
}
