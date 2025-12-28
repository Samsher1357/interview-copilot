/**
 * Text filtering utilities for transcript processing
 */

const IGNORED_PHRASES = /^(ok|okay|yes|no|yeah|yep|nope|uh|um|hmm|ah|eh|right|sure|mhm|uh-huh)$/i

/**
 * Check if text is noise/filler that should be ignored
 */
export function isNoise(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length < 3) return true
  if (IGNORED_PHRASES.test(t)) return true
  if (/^[^\w\s]+$/.test(t)) return true
  return false
}

/**
 * Check if text is meaningful content (not just filler words)
 */
export function isMeaningful(text: string): boolean {
  return text.length >= 5 && !IGNORED_PHRASES.test(text.toLowerCase())
}
