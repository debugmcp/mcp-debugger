/**
 * Global process tracker for test cleanup
 *
 * This module maintains a registry of all processes spawned during tests
 * and provides cleanup utilities to ensure no orphaned processes remain.
 */
import { ChildProcess } from 'child_process';
interface TrackedProcess {
    pid: number;
    name: string;
    process: ChildProcess | {
        pid?: number;
        killed?: boolean;
        kill: (signal?: string) => boolean;
    };
    startTime: number;
}
declare class ProcessTracker {
    private processes;
    private cleanupTimeoutMs;
    /**
     * Register a process for tracking
     */
    register(process: TrackedProcess['process'], name: string): void;
    /**
     * Unregister a process (usually called when process exits normally)
     */
    unregister(pid: number): void;
    /**
     * Kill a specific process
     */
    killProcess(pid: number, signal?: NodeJS.Signals): Promise<boolean>;
    /**
     * Clean up all tracked processes
     */
    cleanupAll(): Promise<void>;
    /**
     * Get count of tracked processes
     */
    getCount(): number;
    /**
     * Get info about tracked processes
     */
    getTrackedProcesses(): Array<{
        pid: number;
        name: string;
        age: number;
    }>;
    /**
     * Reset the tracker (for test isolation)
     */
    reset(): void;
}
export declare const processTracker: ProcessTracker;
export { ProcessTracker };
