/**
 * Re-export shim — the binary-format detector moved to
 * @debugmcp/codelldb-common (issue #324); ABI detection is language-agnostic.
 *
 * Keeps adapter-rust's historical import path stable (package tests vi.mock
 * this specifier). Route adapter source imports through this shim.
 */
export { detectBinaryFormat } from '@debugmcp/codelldb-common';
export type { BinaryInfo } from '@debugmcp/codelldb-common';
