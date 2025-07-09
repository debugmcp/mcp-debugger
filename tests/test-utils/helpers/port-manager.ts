/**
 * Test Port Manager
 * 
 * Provides a centralized way to manage port allocation for tests to avoid conflicts
 * between concurrent test runs.
 */

// Base port to start allocation from
const BASE_PORT = 5679;

// Port ranges for different test types
export enum PortRange {
  UNIT_TESTS = 0,      // 5679-5779
  INTEGRATION = 100,   // 5779-5879
  E2E = 200,           // 5879-5979
}

class TestPortManager {
  private basePort: number;
  private usedPorts: Set<number>;
  private rangeSizes: Map<PortRange, number>;
  
  constructor() {
    this.basePort = BASE_PORT;
    this.usedPorts = new Set<number>();
    
    // Define size of each port range
    this.rangeSizes = new Map<PortRange, number>();
    this.rangeSizes.set(PortRange.UNIT_TESTS, 100);
    this.rangeSizes.set(PortRange.INTEGRATION, 100);
    this.rangeSizes.set(PortRange.E2E, 100);
  }
  
  /**
   * Get a unique port for a test
   * @param range The port range to allocate from
   * @returns An available port number
   */
  getPort(range: PortRange = PortRange.UNIT_TESTS): number {
    const rangeStart = this.basePort + range;
    const rangeSize = this.rangeSizes.get(range) || 100;
    const rangeEnd = rangeStart + rangeSize - 1;
    
    // Find an available port within the range
    for (let port = rangeStart; port <= rangeEnd; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    
    // If we couldn't find an available port in the preferred range,
    // look for any available port
    for (let port = this.basePort; port < this.basePort + 1000; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    
    // If all ports are used, throw an error
    throw new Error(`No available test ports in range ${rangeStart}-${rangeEnd}`);
  }
  
  /**
   * Release a port back to the pool
   * @param port The port to release
   */
  releasePort(port: number): void {
    this.usedPorts.delete(port);
  }
  
  /**
   * Reset all used ports
   */
  reset(): void {
    this.usedPorts.clear();
  }
  
  /**
   * Check if a port is already in use
   * @param port The port to check
   * @returns true if the port is in use
   */
  isPortInUse(port: number): boolean {
    return this.usedPorts.has(port);
  }
  
  /**
   * Get multiple ports at once
   * @param count Number of ports needed
   * @param range The port range to allocate from
   * @returns Array of available ports
   */
  getPorts(count: number, range: PortRange = PortRange.UNIT_TESTS): number[] {
    const ports: number[] = [];
    for (let i = 0; i < count; i++) {
      ports.push(this.getPort(range));
    }
    return ports;
  }
}

// Export a singleton instance
export const portManager = new TestPortManager();

export default portManager;
