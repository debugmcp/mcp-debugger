// Manual mock for fs-extra
import { vi } from 'vitest';

export const access = vi.fn();
export const pathExists = vi.fn();
export const readFile = vi.fn();
export const writeFile = vi.fn();
export const ensureDir = vi.fn();
export const remove = vi.fn();
export const createReadStream = vi.fn();
export const createWriteStream = vi.fn();
export const stat = vi.fn();
export const readdir = vi.fn();
export const copy = vi.fn();
export const move = vi.fn();
export const outputFile = vi.fn();
export const outputJson = vi.fn();
export const readJson = vi.fn();
export const existsSync = vi.fn();
export const mkdir = vi.fn();
export const rmdir = vi.fn();
export const unlink = vi.fn();
export const ensureDirSync = vi.fn();

// Also export as default for compatibility
const mockFsExtra = {
  access,
  pathExists,
  readFile,
  writeFile,
  ensureDir,
  remove,
  createReadStream,
  createWriteStream,
  stat,
  readdir,
  copy,
  move,
  outputFile,
  outputJson,
  readJson,
  existsSync,
  mkdir,
  rmdir,
  unlink,
  ensureDirSync
};

export default mockFsExtra;
