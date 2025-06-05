import { vi } from 'vitest';
import { EventEmitter } from 'events';

const mockNetServer = {
  listen: vi.fn((port: number, callback?: () => void) => {
    if (callback) callback();
    return mockNetServer;
  }),
  close: vi.fn((callback?: (err?: Error) => void) => {
    if (callback) callback();
    return mockNetServer;
  }),
  on: vi.fn(),
  unref: vi.fn(),
  address: vi.fn(() => ({ port: 12345, family: 'IPv4', address: '127.0.0.1' })),
};

const netMock = {
  createServer: vi.fn(() => mockNetServer),
  // Add other net functions if they are used and need mocking
};

export default netMock;
