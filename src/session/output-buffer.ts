/**
 * Per-session ring buffer for debuggee output (issue #218).
 *
 * Holds the DAP 'output' events captured for one launch. Bounded in both
 * entry count and per-entry size so a chatty debuggee cannot grow server
 * memory without limit.
 */
import { SessionOutputEntry } from '@debugmcp/shared';

/** Maximum retained entries per launch; oldest are evicted beyond this. */
export const OUTPUT_BUFFER_CAP = 1000;
/** Per-entry size cap; longer chunks are cut and flagged `truncated`. */
export const MAX_OUTPUT_ENTRY_CHARS = 8192;

export interface OutputReadResult {
  entries: SessionOutputEntry[];
  /** Cursor for the next read: seq of the last returned entry, or the request's `since` when nothing matched */
  nextSince: number;
  /** True when more entries matched than `limit` allowed */
  hasMore: boolean;
  /** Total entries evicted from the buffer since launch */
  dropped: number;
}

export class OutputRingBuffer {
  private entries: SessionOutputEntry[] = [];
  private nextSeq = 1;
  private droppedCount = 0;

  constructor(private readonly cap: number = OUTPUT_BUFFER_CAP) {}

  push(
    category: string,
    output: string,
    timestamp: number = Date.now(),
    flags?: { redacted?: boolean }
  ): SessionOutputEntry {
    const truncated = output.length > MAX_OUTPUT_ENTRY_CHARS;
    const entry: SessionOutputEntry = {
      seq: this.nextSeq++,
      category,
      output: truncated ? output.slice(0, MAX_OUTPUT_ENTRY_CHARS) : output,
      timestamp,
      ...(truncated ? { truncated: true } : {}),
      ...(flags?.redacted ? { redacted: true } : {})
    };
    this.entries.push(entry);
    if (this.entries.length > this.cap) {
      this.entries.shift();
      this.droppedCount++;
    }
    return entry;
  }

  read(since: number, limit: number): OutputReadResult {
    const matched = this.entries.filter(e => e.seq > since);
    const page = matched.slice(0, limit);
    return {
      entries: page,
      nextSince: page.length > 0 ? page[page.length - 1].seq : since,
      hasMore: matched.length > page.length,
      dropped: this.droppedCount
    };
  }

  /**
   * Verbatim concatenation of every retained chunk, in arrival order —
   * what a terminal running the program would have shown (all categories
   * interleaved). Used by the debug://sessions/{id}/output resource.
   */
  renderText(): string {
    return this.entries.map(e => e.output).join('');
  }
}
