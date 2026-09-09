/** The JSON-RPC error envelope the HTTP transport answers with outside a request context (no id is known). */
export interface JsonRpcErrorBody {
  jsonrpc: '2.0';
  error: { code: number; message: string; data?: unknown };
  id: null;
}

export function jsonRpcErrorBody(code: number, message: string, data?: unknown): JsonRpcErrorBody {
  const error: JsonRpcErrorBody['error'] = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: '2.0', error, id: null };
}
