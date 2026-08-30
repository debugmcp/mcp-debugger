/** A pause request scoped to the proxy generation that received it. */
export interface PauseIntent {
  generation: number;
  source: 'user' | 'attach';
  armedAt: number;
}

interface PauseIntentSession {
  proxyGeneration?: number;
  pauseIntent?: PauseIntent;
}

/** Start a new proxy generation and invalidate every earlier pause request. */
export function beginProxyGeneration(session: PauseIntentSession): number {
  const generation = (session.proxyGeneration ?? 0) + 1;
  session.proxyGeneration = generation;
  session.pauseIntent = undefined;
  return generation;
}

/** Arm a pause against the currently installed proxy only. */
export function armPauseIntent(
  session: PauseIntentSession,
  source: PauseIntent['source']
): PauseIntent {
  const intent: PauseIntent = {
    generation: session.proxyGeneration ?? 0,
    source,
    armedAt: Date.now()
  };
  session.pauseIntent = intent;
  return intent;
}

/** Whether this session's intent belongs to its current proxy generation. */
export function hasCurrentPauseIntent(session: PauseIntentSession): boolean {
  return session.pauseIntent !== undefined &&
    session.pauseIntent.generation === (session.proxyGeneration ?? 0);
}

/** Clear one current intent, optionally only if it is the expected object. */
export function clearPauseIntent(
  session: PauseIntentSession,
  expected?: PauseIntent
): void {
  if (!expected || session.pauseIntent === expected) {
    session.pauseIntent = undefined;
  }
}
