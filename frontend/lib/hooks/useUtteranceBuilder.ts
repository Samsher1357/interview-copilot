'use client'

import { useCallback, useRef, useEffect } from 'react'
import { Utterance, ClosedBy } from '../types'
import { detectTurnEnd } from '../utils/turnDetector'
import { textSimilarity, confidenceVariance } from '../utils/textSimilarity'

// Balanced timing - tuned for responsiveness
const SILENCE_THRESHOLD_MS = 1400      // Reduced from 1800ms
const STABILITY_WINDOW_MS = 400        // Reduced from 500ms
const MIN_WORDS = 4                    // Reduced from 5
const MIN_CONFIDENCE = 0.65            // Reduced from 0.7
const TEXT_SIMILARITY_THRESHOLD = 0.85 // For ASR variance guard
const MAX_CONFIDENCE_VARIANCE = 0.18   // Slightly more tolerant (was 0.15)

interface UtteranceBuilderConfig {
  onUtteranceComplete: (utterance: Utterance) => void
  onContinueListening?: () => void  // Called when user is mid-thought
}

interface DeepgramResult {
  text: string
  confidence: number
  isFinal: boolean
  speechFinal: boolean
}

export function useUtteranceBuilder(config: UtteranceBuilderConfig) {
  const { onUtteranceComplete, onContinueListening } = config

  // Accumulator state
  const accumulatorRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const lastActivityRef = useRef<number>(0)
  const confidenceAccRef = useRef<number[]>([])
  
  // Stability tracking with ASR variance guard
  const consecutiveFinalsRef = useRef<number>(0)
  const lastFinalTextRef = useRef<string>('')  // For similarity check
  const lastSpeechFinalTimeRef = useRef<number>(0)
  
  // Timers
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current)
      stabilityTimerRef.current = null
    }
  }, [])

  const getAverageConfidence = useCallback(() => {
    const confidences = confidenceAccRef.current
    if (confidences.length === 0) return 0
    return confidences.reduce((a, b) => a + b, 0) / confidences.length
  }, [])

  const commitUtterance = useCallback((closedBy: ClosedBy) => {
    const text = accumulatorRef.current.trim()
    if (!text) return

    const wordCount = text.split(/\s+/).length
    const avgConfidence = getAverageConfidence()
    const confVariance = confidenceVariance(confidenceAccRef.current)

    // Final validation before commit
    if (wordCount < MIN_WORDS) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Skipping: too short (${wordCount}/${MIN_WORDS})`)
      }
      return
    }
    
    if (avgConfidence < MIN_CONFIDENCE) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Skipping: low confidence (${avgConfidence.toFixed(2)})`)
      }
      return
    }

    if (confVariance > MAX_CONFIDENCE_VARIANCE) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Skipping: unstable confidence (variance: ${confVariance.toFixed(2)})`)
      }
      scheduleSilenceCheck() // Wait longer
      return
    }

    const utterance: Utterance = {
      id: `utt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      speaker: 'user',
      text,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      confidence: avgConfidence,
      closedBy,
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[UtteranceBuilder] Committing: "${text.slice(0, 50)}..." (${closedBy}, conf: ${avgConfidence.toFixed(2)})`)
    }

    // Reset state
    accumulatorRef.current = ''
    startTimeRef.current = 0
    confidenceAccRef.current = []
    consecutiveFinalsRef.current = 0
    lastFinalTextRef.current = ''
    lastSpeechFinalTimeRef.current = 0
    clearTimers()

    onUtteranceComplete(utterance)
  }, [onUtteranceComplete, clearTimers, getAverageConfidence])

  const scheduleSilenceCheck = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatorRef.current.trim()
      if (text && text.split(/\s+/).length >= MIN_WORDS) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[UtteranceBuilder] Silence timeout triggered`)
        }
        commitUtterance('silence')
      }
    }, SILENCE_THRESHOLD_MS)
  }, [commitUtterance])

  const scheduleStabilityCheck = useCallback(() => {
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current)
    }

    stabilityTimerRef.current = setTimeout(() => {
      const text = accumulatorRef.current.trim()
      const wordCount = text.split(/\s+/).length
      const avgConfidence = getAverageConfidence()
      const consecutiveFinals = consecutiveFinalsRef.current

      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Stability check: words=${wordCount}, conf=${avgConfidence.toFixed(2)}, finals=${consecutiveFinals}, text="${text.slice(0, 50)}..."`)
      }

      const detection = detectTurnEnd(
        {
          text,
          silenceMs: Date.now() - lastActivityRef.current,
          confidence: avgConfidence,
          isFinal: true,
          speechFinal: true,
          consecutiveFinals,
        },
        { silenceThresholdMs: SILENCE_THRESHOLD_MS, minWords: MIN_WORDS, minConfidence: MIN_CONFIDENCE }
      )

      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Detection result: shouldClose=${detection.shouldClose}, closedBy=${detection.closedBy}, reason=${detection.reason}`)
      }

      if (detection.shouldClose) {
        commitUtterance(detection.closedBy)
      } else {
        // If not closing, schedule silence check as fallback
        scheduleSilenceCheck()
      }
    }, STABILITY_WINDOW_MS)
  }, [commitUtterance, getAverageConfidence, scheduleSilenceCheck])

  const processResult = useCallback((result: DeepgramResult) => {
    const { text, confidence, isFinal, speechFinal } = result
    const trimmed = text.trim()
    if (!trimmed) return

    const now = Date.now()

    // Start new utterance if needed
    if (!startTimeRef.current) {
      startTimeRef.current = now
      if (process.env.NODE_ENV === 'development') {
        console.log(`[UtteranceBuilder] Starting new utterance`)
      }
    }

    lastActivityRef.current = now
    clearTimers()

    // Only accumulate final results
    if (isFinal) {
      // Update accumulator
      const currentText = accumulatorRef.current
      if (!currentText.endsWith(trimmed)) {
        accumulatorRef.current = currentText ? currentText + ' ' + trimmed : trimmed
      }
      
      confidenceAccRef.current.push(confidence)

      if (speechFinal) {
        // ASR Variance Guard: Check text similarity with previous final
        const prevText = lastFinalTextRef.current
        if (prevText) {
          const similarity = textSimilarity(prevText, trimmed)
          
          if (similarity < TEXT_SIMILARITY_THRESHOLD) {
            // Text changed significantly - ASR is unstable, don't increment
            if (process.env.NODE_ENV === 'development') {
              console.log(`[UtteranceBuilder] ASR variance detected (similarity: ${similarity.toFixed(2)}), resetting finals`)
            }
            consecutiveFinalsRef.current = 1  // Reset to 1, not 0
          } else {
            consecutiveFinalsRef.current++
          }
        } else {
          consecutiveFinalsRef.current = 1
        }
        
        lastFinalTextRef.current = trimmed
        lastSpeechFinalTimeRef.current = now
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[UtteranceBuilder] Speech final #${consecutiveFinalsRef.current}: "${trimmed.slice(0, 30)}..."`)
        }        
        // Check for immediate semantic closure (punctuation)
        const detection = detectTurnEnd(
          {
            text: accumulatorRef.current,
            silenceMs: 0,
            confidence: getAverageConfidence(),
            isFinal: true,
            speechFinal: true,
            consecutiveFinals: consecutiveFinalsRef.current,
          },
          { silenceThresholdMs: SILENCE_THRESHOLD_MS, minWords: MIN_WORDS, minConfidence: MIN_CONFIDENCE }
        )

        if (detection.shouldClose && detection.closedBy === 'semantic') {
          commitUtterance('semantic')
        } else {
          scheduleStabilityCheck()
        }
      } else {
        // Non-speech-final: reset consecutive counter
        consecutiveFinalsRef.current = 0
        lastFinalTextRef.current = ''
        scheduleSilenceCheck()
      }
    }
  }, [commitUtterance, clearTimers, getAverageConfidence, scheduleStabilityCheck, scheduleSilenceCheck])

  const getInterimText = useCallback(() => accumulatorRef.current, [])

  const forceCommit = useCallback(() => {
    const text = accumulatorRef.current.trim()
    if (text && text.split(/\s+/).length >= 3) {
      commitUtterance('silence')
    }
  }, [commitUtterance])

  const reset = useCallback(() => {
    accumulatorRef.current = ''
    startTimeRef.current = 0
    lastActivityRef.current = 0
    confidenceAccRef.current = []
    consecutiveFinalsRef.current = 0
    lastFinalTextRef.current = ''
    lastSpeechFinalTimeRef.current = 0
    clearTimers()
  }, [clearTimers])

  // Reset timers only (for "continue" intent)
  const resetTimers = useCallback(() => {
    clearTimers()
    if (accumulatorRef.current.trim()) {
      scheduleSilenceCheck()
    }
  }, [clearTimers, scheduleSilenceCheck])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return {
    processResult,
    getInterimText,
    forceCommit,
    reset,
    resetTimers,
  }
}
