import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const mockNetServer = {
  listen: jest.fn((port: number, callback?: () => void) => {
    if (callback) callback();
    return mockNetServer;
  }),
  close: jest.fn((callback?: (err?: Error) => void) => {
    if (callback) callback();
    return mockNetServer;
  }),
  on: jest.fn(),
  unref: jest.fn(),
  address: jest.fn(() => ({ port: 12345, family: 'IPv4', address: '127.0.0.1' })),
};

const netMock = {
  createServer: jest.fn(() => mockNetServer),
  // Add other net functions if they are used and need mocking
};

export default netMock;
