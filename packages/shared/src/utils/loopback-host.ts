/**
 * One answer to "does this host name mean this machine?" for every attach
 * path (issue #903). Attach locality decides whether the file on the
 * mcp-debugger host is the debuggee's own source (issue #899) and whether a
 * processId attach may proceed at all (the JavaScript inspector activation,
 * issue #871); before this the ruby adapter and the JavaScript activation
 * each kept a private list.
 *
 * Accepts the spellings a caller or a debugger prints: `localhost`, any
 * 127.0.0.0/8 address, `::1` with or without brackets, and the IPv4-mapped
 * `::ffff:127.x.y.z`. Case-insensitive; surrounding whitespace is ignored.
 * Anything else — a LAN address, a container or pod name, `0.0.0.0` — is not
 * loopback: `0.0.0.0` is a bind-all address, never a destination.
 */
export function isLoopbackHost(host: string | undefined | null): boolean {
  if (typeof host !== 'string') {
    return false;
  }
  let candidate = host.trim().toLowerCase();
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    candidate = candidate.slice(1, -1);
  }
  if (candidate === 'localhost' || candidate === '::1') {
    return true;
  }
  if (candidate.startsWith('::ffff:')) {
    candidate = candidate.slice('::ffff:'.length);
  }
  const octets = candidate.split('.');
  return (
    octets.length === 4 &&
    octets[0] === '127' &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}
