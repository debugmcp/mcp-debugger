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

/**
 * Internal buffered record: extends the public wire entry with whether the
 * source omitted an explicit DAP `category` (issue #1277). Stripped by `read()`
 * and `push()` so it never appears in `get_output`, events, or resources.
 */
export interface BufferedOutputEntry extends SessionOutputEntry {
  categoryOmitted?: boolean;
}

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
  private entries: BufferedOutputEntry[] = [];
  private nextSeq = 1;
  private droppedCount = 0;

  constructor(private readonly cap: number = OUTPUT_BUFFER_CAP) {}

  push(
    category: string,
    output: string,
    timestamp: number = Date.now(),
    flags?: { redacted?: boolean; categoryOmitted?: boolean }
  ): SessionOutputEntry {
    const truncated = output.length > MAX_OUTPUT_ENTRY_CHARS;
    const publicEntry: SessionOutputEntry = {
      seq: this.nextSeq++,
      category,
      output: truncated ? output.slice(0, MAX_OUTPUT_ENTRY_CHARS) : output,
      timestamp,
      ...(truncated ? { truncated: true } : {}),
      ...(flags?.redacted ? { redacted: true } : {})
    };
    const stored: BufferedOutputEntry = flags?.categoryOmitted
      ? { ...publicEntry, categoryOmitted: true }
      : publicEntry;
    this.entries.push(stored);
    if (this.entries.length > this.cap) {
      this.entries.shift();
      this.droppedCount++;
    }
    return publicEntry;
  }

  read(since: number, limit: number): OutputReadResult {
    const matched = this.entries.filter(e => e.seq > since);
    const page = matched.slice(0, limit).map(({ categoryOmitted: _omitted, ...entry }) => entry);
    return {
      entries: page,
      nextSince: page.length > 0 ? page[page.length - 1].seq : since,
      hasMore: matched.length > page.length,
      dropped: this.droppedCount
    };
  }

  /** Internal snapshot retaining `categoryOmitted` for `outputTail` / `outputBeforeFailure` (#1277). */
  readBuffered(): readonly BufferedOutputEntry[] {
    return this.entries;
  }

  /**
   * Verbatim concatenation of every retained chunk, in arrival order —
   * what a terminal running the program would have shown (all categories
   * interleaved). Used by the debug://sessions/{id}/output resource.
   */
  renderText(): string {
    return this.entries.map(e => e.output).join('');
  }

  /**
   * The last `maxChars` characters of the transcript, gathered from the newest entries back —
   * what a policy reads the program's end from (issue #877) without joining a full buffer.
   */
  renderTail(maxChars: number): string {
    if (maxChars <= 0) {
      return '';
    }
    const parts: string[] = [];
    let length = 0;
    for (let i = this.entries.length - 1; i >= 0 && length < maxChars; i--) {
      parts.push(this.entries[i].output);
      length += this.entries[i].output.length;
    }
    return parts.reverse().join('').slice(-maxChars);
  }
}
