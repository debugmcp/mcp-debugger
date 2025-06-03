import { jest } from '@jest/globals';

const fsExtraMock = {
  ensureDir: jest.fn(async () => {}), // Mock implementation that returns a resolved promise of void
  pathExists: jest.fn(async () => true), // Mock implementation that returns a resolved promise of true
  // Add other fs-extra functions if they are used and need mocking
};

// To ensure the mock implementations are set correctly for jest.fn:
fsExtraMock.ensureDir.mockResolvedValue(undefined);
fsExtraMock.pathExists.mockResolvedValue(true);


export default fsExtraMock;
