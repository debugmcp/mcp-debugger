/**
 * Incremental newline splitter for streamed output.
 *
 * Stream 'data' events are chunked at arbitrary byte boundaries, so
 * content-based filters (e.g. stderr secret redaction) must only ever see
 * whole lines — a pattern split across two chunks would slip past them
 * (issue #151). Append chunks as they arrive: complete lines come back
 * immediately, the trailing partial line is held until the next append or
 * flush().
 */
export class LineBuffer {
  private pending = '';

  /**
   * @param maxPendingLength Bound on the held partial line so a newline-free
   * stream cannot grow memory without limit; once exceeded, the pending data
   * is emitted as if it were a complete line.
   */
  constructor(private readonly maxPendingLength = 8192) {}

  /** Add a chunk; returns the complete lines it produced (CR stripped). */
  append(chunk: string): string[] {
    this.pending += chunk;
    const parts = this.pending.split('\n');
    this.pending = parts.pop() ?? '';
    const lines = parts.map(line => (line.endsWith('\r') ? line.slice(0, -1) : line));
    if (this.pending.length > this.maxPendingLength) {
      lines.push(this.pending);
      this.pending = '';
    }
    return lines;
  }

  /** Emit any held partial line; call when the stream ends. */
  flush(): string[] {
    if (this.pending === '') {
      return [];
    }
    const line = this.pending;
    this.pending = '';
    return [line];
  }
}
