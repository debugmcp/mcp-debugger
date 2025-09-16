/**
 * Global process tracker for test cleanup
 *
 * This module maintains a registry of all processes spawned during tests
 * and provides cleanup utilities to ensure no orphaned processes remain.
 */
import { createLogger } from '../../../src/utils/logger.js';
const logger = createLogger('test:process-tracker');
class ProcessTracker {
    processes = new Map();
    cleanupTimeoutMs = 5000;
    /**
     * Register a process for tracking
     */
    register(process, name) {
        if (!process.pid) {
            logger.warn(`[ProcessTracker] Cannot track process without PID: ${name}`);
            return;
        }
        const entry = {
            pid: process.pid,
            name,
            process,
            startTime: Date.now()
        };
        this.processes.set(process.pid, entry);
        logger.debug(`[ProcessTracker] Registered process: ${name} (PID: ${process.pid})`);
        // Auto-remove when process exits
        if ('once' in process && typeof process.once === 'function') {
            process.once('exit', () => {
                this.unregister(process.pid);
            });
        }
    }
    /**
     * Unregister a process (usually called when process exits normally)
     */
    unregister(pid) {
        if (this.processes.delete(pid)) {
            logger.debug(`[ProcessTracker] Unregistered process: PID ${pid}`);
        }
    }
    /**
     * Kill a specific process
     */
    async killProcess(pid, signal = 'SIGTERM') {
        const tracked = this.processes.get(pid);
        if (!tracked) {
            return false;
        }
        try {
            if (!tracked.process.killed) {
                tracked.process.kill(signal);
                // Wait a bit for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 100));
                // Force kill if still alive
                if (!tracked.process.killed) {
                    tracked.process.kill('SIGKILL');
                }
            }
            this.unregister(pid);
            return true;
        }
        catch (error) {
            logger.error(`[ProcessTracker] Error killing process ${pid}:`, error);
            return false;
        }
    }
    /**
     * Clean up all tracked processes
     */
    async cleanupAll() {
        const count = this.processes.size;
        if (count === 0) {
            logger.debug('[ProcessTracker] No processes to clean up');
            return;
        }
        logger.info(`[ProcessTracker] Cleaning up ${count} tracked processes`);
        const cleanupPromises = [];
        for (const [pid, tracked] of this.processes) {
            logger.debug(`[ProcessTracker] Terminating: ${tracked.name} (PID: ${pid}, age: ${Date.now() - tracked.startTime}ms)`);
            cleanupPromises.push(this.killProcess(pid));
        }
        const results = await Promise.all(cleanupPromises);
        const succeeded = results.filter(r => r).length;
        const failed = results.length - succeeded;
        if (failed > 0) {
            logger.warn(`[ProcessTracker] Cleanup complete: ${succeeded} succeeded, ${failed} failed`);
        }
        else {
            logger.info(`[ProcessTracker] Successfully cleaned up ${succeeded} processes`);
        }
        // Clear the map
        this.processes.clear();
    }
    /**
     * Get count of tracked processes
     */
    getCount() {
        return this.processes.size;
    }
    /**
     * Get info about tracked processes
     */
    getTrackedProcesses() {
        return Array.from(this.processes.values()).map(p => ({
            pid: p.pid,
            name: p.name,
            age: Date.now() - p.startTime
        }));
    }
    /**
     * Reset the tracker (for test isolation)
     */
    reset() {
        this.processes.clear();
    }
}
// Export singleton instance for global tracking
export const processTracker = new ProcessTracker();
// Export for testing
export { ProcessTracker };
//# sourceMappingURL=process-tracker.js.map