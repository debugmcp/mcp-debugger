/**
 * DAP wire-format codec — re-exported from @debugmcp/shared (moved there so the
 * COBOL DAP shim can bundle the same decoder; issue #759). The server-side
 * import path stays stable.
 */
export { DapFrameDecoder, encodeDapMessage } from '@debugmcp/shared';
export type { DapFrameDecoderErrorContext, DapFrameDecoderOptions } from '@debugmcp/shared';
