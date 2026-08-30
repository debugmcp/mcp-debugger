/**
 * Statement-anchor re-resolution (issue #271).
 *
 * A content-addressed breakpoint remembers the statement it was set on, not
 * just a line. Whenever the file underneath it may have changed — a restart
 * replaying the launch, or a JVM hot swap (issue #464) — the anchors are
 * re-resolved against what is on disk now, so the breakpoint follows the code
 * instead of the line number.
 *
 * A free function rather than a method because both callers live in different
 * collaborators and it needs nothing but a filesystem and a logger.
 */
import { getErrorMessage } from '../../errors/debug-errors.js';
import { resolveStatement } from '../../utils/breakpoint-resolver.js';
import type { Breakpoint, IFileSystem, ILogger } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';

/** What re-resolution needs: the file's current text, and somewhere to narrate. */
export interface AnchorResolutionDeps {
  logger: ILogger;
  fileSystem: Pick<IFileSystem, 'readFile'>;
}

/** An anchor that re-resolved to a different line than the breakpoint held. */
export interface AnchorMove {
  breakpointId: string;
  file: string;
  from: number;
  to: number;
  statement: string;
  candidates?: number[];
}

/** An anchor that no longer matches; the breakpoint keeps its stale line. */
export interface AnchorStale {
  breakpointId: string;
  file: string;
  line: number;
  statement: string;
  reason: string;
}

export interface AnchorResolution {
  moved: AnchorMove[];
  stale: AnchorStale[];
}

/**
 * Re-resolve statement-anchored breakpoints against the current file
 * contents (fresh read — deliberately not the server's LineReader cache).
 * The breakpoint's current line doubles as the nearLine hint so duplicate
 * statements re-anchor to the nearest occurrence of where the breakpoint
 * last was. Anchors that no longer match keep their stale line and warn:
 * failing the restart would block the edit-relaunch loop, and dropping the
 * breakpoint would destroy user state (issue #271).
 *
 * Returns undefined when the session has no anchored breakpoints at all.
 */
export async function reresolveAnchors(
  session: Pick<ManagedSession, 'breakpoints'>,
  ctx: AnchorResolutionDeps
): Promise<AnchorResolution | undefined> {
  const anchored = Array.from(session.breakpoints.values()).filter(
    (bp): bp is Breakpoint & { anchor: { statement: string; nearLine?: number } } => bp.anchor !== undefined
  );
  if (anchored.length === 0) {
    return undefined;
  }

  const moved: AnchorMove[] = [];
  const stale: AnchorStale[] = [];

  const byFile = new Map<string, typeof anchored>();
  for (const bp of anchored) {
    const group = byFile.get(bp.file);
    if (group) {
      group.push(bp);
    } else {
      byFile.set(bp.file, [bp]);
    }
  }

  for (const [file, bps] of byFile) {
    let lines: string[] | null = null;
    try {
      const content = await ctx.fileSystem.readFile(file, 'utf8');
      lines = content.split(/\r?\n/);
    } catch (error) {
      ctx.logger.warn(
        `[SessionManager] Could not re-read ${file} for anchor re-resolution: ${
          getErrorMessage(error)
        }`
      );
    }

    for (const bp of bps) {
      if (!lines) {
        stale.push({
          breakpointId: bp.id,
          file,
          line: bp.line,
          statement: bp.anchor.statement,
          reason: 'file unreadable',
        });
        continue;
      }
      const resolution = resolveStatement(lines, bp.anchor.statement, file, bp.line);
      if (resolution.ok) {
        if (resolution.line !== bp.line) {
          moved.push({
            breakpointId: bp.id,
            file,
            from: bp.line,
            to: resolution.line,
            statement: bp.anchor.statement,
            // The bp's old line doubles as nearLine here, so the ambiguity
            // error can never fire on this path — a multi-match proximity
            // pick must be flagged instead of passing as unambiguous
            // (issue #379).
            ...(resolution.candidates !== undefined ? { candidates: resolution.candidates } : {}),
          });
          ctx.logger.info(
            `[SessionManager] Anchor re-resolved: breakpoint ${bp.id} moved ${bp.line} -> ${resolution.line} ("${bp.anchor.statement}")`
          );
          bp.line = resolution.line;
          bp.requestedLine = resolution.line;
        }
      } else {
        stale.push({
          breakpointId: bp.id,
          file,
          line: bp.line,
          statement: bp.anchor.statement,
          reason: 'statement not found',
        });
      }
    }
  }

  return { moved, stale };
}
