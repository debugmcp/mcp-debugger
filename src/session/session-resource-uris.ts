/** Pure URI composition/parsing shared by session diagnostics and MCP resources. */

export function outputResourceUri(sessionId: string): string {
  return `debug://sessions/${sessionId}/output`;
}

export function proxyLogResourceUri(sessionId: string): string {
  return `debug://sessions/${sessionId}/proxy-log`;
}

/** Returns the sessionId encoded in a debug output resource URI, or undefined. */
export function parseOutputResourceUri(uri: string): string | undefined {
  const match = /^debug:\/\/sessions\/([^/]+)\/output$/.exec(uri);
  return match?.[1];
}

/** Returns the sessionId encoded in a debug proxy-log resource URI, or undefined. */
export function parseProxyLogResourceUri(uri: string): string | undefined {
  const match = /^debug:\/\/sessions\/([^/]+)\/proxy-log$/.exec(uri);
  return match?.[1];
}
