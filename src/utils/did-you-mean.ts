/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Finds the closest matching string from a list of valid strings using Levenshtein distance.
 * Returns the closest match if its distance is within the threshold, otherwise returns null.
 *
 * Real typos are almost always 1-2 edits; distance 3 starts reaching *different*
 * keys (a wrong suggestion an agent will obey), so the default threshold is 2.
 * For short strings (<= 4 characters) the threshold is strictly 1 — e.g. `host`
 * must not suggest `port`.
 */
export function didYouMean(target: string, validStrings: readonly string[], threshold = 2): string | null {
  if (!validStrings || validStrings.length === 0) return null;

  const actualThreshold = target.length <= 4 ? 1 : threshold;

  let closestMatch: string | null = null;
  let minDistance = Infinity;

  for (const validString of validStrings) {
    const distance = levenshtein(target.toLowerCase(), validString.toLowerCase());
    
    if (distance <= actualThreshold && distance < minDistance) {
      minDistance = distance;
      closestMatch = validString;
    }
  }

  return closestMatch;
}
