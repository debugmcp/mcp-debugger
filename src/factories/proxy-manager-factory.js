/**
 * Factory for creating ProxyManager instances
 * Enables dependency injection and easy mocking for tests
 */
import { ProxyManager } from '../proxy/proxy-manager.js';
/**
 * Production implementation of ProxyManager factory
 */
export class ProxyManagerFactory {
    proxyProcessLauncher;
    fileSystem;
    logger;
    constructor(proxyProcessLauncher, fileSystem, logger) {
        this.proxyProcessLauncher = proxyProcessLauncher;
        this.fileSystem = fileSystem;
        this.logger = logger;
    }
    create(adapter) {
        return new ProxyManager(adapter || null, // Pass adapter or null if not provided
        this.proxyProcessLauncher, this.fileSystem, this.logger);
    }
}
/**
 * Mock implementation of ProxyManager factory for testing
 * This creates a simple stub that should be replaced by test code
 * with the actual MockProxyManager from tests/mocks/mock-proxy-manager.ts
 */
export class MockProxyManagerFactory {
    createdManagers = [];
    createFn;
    lastAdapter;
    create(adapter) {
        this.lastAdapter = adapter; // Track the adapter for testing
        if (this.createFn) {
            const manager = this.createFn(adapter);
            this.createdManagers.push(manager);
            return manager;
        }
        // Return a minimal stub if no custom create function is provided
        throw new Error('MockProxyManagerFactory requires createFn to be set in tests');
    }
}
//# sourceMappingURL=proxy-manager-factory.js.map