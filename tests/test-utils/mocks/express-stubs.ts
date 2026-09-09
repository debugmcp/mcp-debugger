import { vi, type Mock } from 'vitest';

export interface FakeExpressResponse {
  headersSent: boolean;
  status: Mock<(code: number) => { json: Mock }>;
  json: Mock;
}

export interface MiddlewareOutcome {
  res: FakeExpressResponse;
  /** The `res.status(...).json(...)` recorder: `json.mock.calls[0][0]` is the body sent. */
  json: Mock;
  next: Mock;
}

/**
 * Drive one Express middleware by hand with a minimal request and record what
 * it did: the status it set, the JSON body it sent, or the `next()` it called.
 */
export function invokeMiddleware(
  middleware: (req: never, res: never, next: never) => unknown,
  req: { headers?: Record<string, string>; method?: string } = {}
): MiddlewareOutcome {
  const json = vi.fn();
  const res: FakeExpressResponse = { headersSent: false, status: vi.fn(() => ({ json })), json };
  const next = vi.fn();
  middleware({ method: 'GET', headers: {}, ...req } as never, res as never, next as never);
  return { res, json, next };
}
