/**
 * Environment implementation that wraps Node.js process.env and process.cwd()
 */
/**
 * Production implementation of IEnvironment
 * Provides access to real process environment variables and working directory
 */
export class ProcessEnvironment {
    envSnapshot;
    constructor() {
        // Create an immutable snapshot of environment variables at construction time
        // This prevents mid-execution environment changes from affecting behavior
        this.envSnapshot = { ...process.env };
    }
    /**
     * Get a specific environment variable
     */
    get(key) {
        return this.envSnapshot[key];
    }
    /**
     * Get all environment variables
     */
    getAll() {
        // Return a copy to prevent external modifications
        return { ...this.envSnapshot };
    }
    /**
     * Get the current working directory
     */
    getCurrentWorkingDirectory() {
        return process.cwd();
    }
}
//# sourceMappingURL=environment-impl.js.map