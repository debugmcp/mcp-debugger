/**
 * Fixture for issue #642: reports the working directory and one environment
 * variable so a test can assert the launch config's cwd/env actually reached
 * the debuggee (the JDI bridge used to accept both and apply neither).
 */
public class EnvCwdTest {
    public static void main(String[] args) throws Exception {
        System.out.println("user.dir=" + System.getProperty("user.dir"));
        System.out.println("MCP_TEST_VAR=" + System.getenv("MCP_TEST_VAR"));
        System.out.println("done");
    }
}
