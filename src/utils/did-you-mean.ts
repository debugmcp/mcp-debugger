/**
 * Computes the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Finds the closest match for a target string from an array of valid strings.
 * Returns the closest string if the distance is within a reasonable threshold, otherwise undefined.
 */
export function didYouMean(target: string, validStrings: readonly string[], threshold = 3): string | undefined {
  if (!validStrings || validStrings.length === 0) {
    return undefined;
  }

  let closestMatch: string | undefined = undefined;
  let minDistance = Infinity;

  for (const valid of validStrings) {
    const distance = levenshteinDistance(target, valid);
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = valid;
    }
  }

  // Adjust threshold for very short strings
  const effectiveThreshold = Math.min(threshold, Math.max(1, Math.floor(target.length / 2)));
  
  if (minDistance <= effectiveThreshold) {
    return closestMatch;
  }

  return undefined;
}
