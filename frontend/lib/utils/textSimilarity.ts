/**
 * Calculate Jaccard similarity between two strings
 * Used to detect ASR variance and prevent false finals
 */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 0))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++
  }

  const union = wordsA.size + wordsB.size - intersection
  return intersection / union
}

/**
 * Check if new text is a natural continuation of previous text
 * Returns true if it looks like the same utterance continuing
 */
export function isContinuation(prevText: string, newText: string): boolean {
  if (!prevText || !newText) return false
  
  const prev = prevText.trim().toLowerCase()
  const curr = newText.trim().toLowerCase()
  
  // New text should start with or contain most of previous text
  if (curr.startsWith(prev)) return true
  
  // Or have high similarity (ASR correction)
  return textSimilarity(prev, curr) >= 0.7
}

/**
 * Calculate confidence variance to detect unstable ASR
 */
export function confidenceVariance(confidences: number[]): number {
  if (confidences.length < 2) return 0
  
  const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length
  const squaredDiffs = confidences.map(c => Math.pow(c - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / confidences.length)
}
