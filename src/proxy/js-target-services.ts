/**
 * What the proxy runs beside one js-debug target (issue #1212).
 *
 * js-debug hands out one raw CDP socket per target (`requestCDPProxy` on that
 * target's DAP connection). Two things of the proxy's ride on it: the bridge
 * (the logpoint binding and its messages, function breakpoints; issues #295,
 * #850) and the proxy's own stepper, which listens on the same socket (issue
 * #1130). The program's own target had both, built inside
 * ChildSessionManager; a fork had a socket for its stepper alone, built
 * inside ChildConnections, so a logpoint in a fork had no channel of the
 * debugger's and printed into the fork's stdout.
 *
 * This is that composition, once: every target gets the same socket and the
 * same things on it. What each caller still owns is the order in which its
 * target's events leave (the program's target has entry stops and function
 * breakpoints to relabel; a fork has neither).
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { CdpFunctionBreakpointBridge } from './cdp-function-breakpoint-bridge.js';
import { CdpProxyClient } from './cdp-proxy-client.js';
import { JsStepper } from './js-stepper.js';

export interface JsTargetServicesOptions {
  /** The proxy's own stepper serves this target's steps (the policy keeps the adapter's off, issue #1130). */
  stepper: boolean;
  /** The adapter's function breakpoints and logpoint delivery go over CDP (issue #295). */
  bridge: boolean;
  /** A request on the target's own DAP connection. */
  sendRequest: (command: string, args?: unknown, timeoutMs?: number) => Promise<unknown>;
  /** The one `stopped` the stepper reports for a step it served. */
  deliverStep: (event: DebugProtocol.Event) => void;
  /** Test seam: the bridge itself. */
  bridgeFactory?: () => CdpFunctionBreakpointBridge;
  /** Test seam: the CDP socket the default bridge opens, which the stepper shares. */
  cdpClientFactory?: () => CdpProxyClient;
}

export class JsTargetServices {
  /** Present when the policy keeps the adapter's stepper off. */
  readonly stepper: JsStepper | null;
  /** Present when the policy delivers function breakpoints over CDP. */
  readonly bridge: CdpFunctionBreakpointBridge | null;

  constructor(options: JsTargetServicesOptions) {
    this.stepper = options.stepper
      ? new JsStepper({
          target: {
            sendRequest: (command, args, timeoutMs) => options.sendRequest(command, args, timeoutMs) as Promise<never>
          },
          deliver: options.deliverStep
        })
      : null;
    // One CDP socket per target: the bridge opens it, the stepper listens on it too.
    this.bridge = options.bridge
      ? options.bridgeFactory?.() ??
        new CdpFunctionBreakpointBridge({
          clientFactory: () => {
            const client = options.cdpClientFactory?.() ?? new CdpProxyClient();
            this.stepper?.attachCdp(client);
            return client;
          }
        })
      : null;
  }

  /** The target's connection is gone, or the proxy is letting go of it: close the socket and what rides on it. */
  detach(): void {
    this.stepper?.detachCdp();
    this.bridge?.detach();
  }
}
