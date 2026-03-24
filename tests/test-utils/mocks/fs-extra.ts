import { vi } from 'vitest';

const fsExtraMock = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(true),
};


export default fsExtraMock;
