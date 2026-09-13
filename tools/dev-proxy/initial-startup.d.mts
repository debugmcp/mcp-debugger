/** True on startup completion, false when the shared discovery deadline expires. */
export function createInitialStartupGate(timeoutMs: number): {
  ready: Promise<boolean>;
  complete(): void;
};
