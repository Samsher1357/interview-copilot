import '../config/env'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TranscriptEntry, InterviewContext } from '../types'
import { buildInterviewSystemPrompt } from '../ai/promptBuilder'

/* ======================================================
   TYPES
====================================================== */

/* ======================================================
   CONSTANTS
====================================================== */

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_HISTORY = 20
const STREAM_FLUSH_CHARS = 8
const MAX_CACHE_SIZE = 10 // Maximum number of LLM instances to cache

/* ======================================================
   SERVICE
====================================================== */

export class LangChainService {
  private readonly llmCache = new Map<string, BaseChatModel>()
  private readonly cacheAccessOrder: string[] = [] // Track access order for LRU

  constructor() {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      throw new Error('Missing AI API keys')
    }
  }

  /* ======================================================
     PUBLIC API
  ====================================================== */

  /**
   * 🔥 FAST PATH – real-time streaming (NO JSON)
   * Optimized for lowest latency possible
   */
  async *streamAnalysis(
    transcripts: TranscriptEntry[],
    interviewContext?: InterviewContext,
    simpleEnglish = false,
    aiModel = DEFAULT_MODEL
  ): AsyncGenerator<string> {
    const latest = transcripts.at(-1)
    if (!latest?.speaker || latest.speaker !== 'user') return

    try {
      const llm = this.getLLM(aiModel)

      const systemPrompt = this.buildSystemPrompt({
        transcripts,
        interviewContext,
        latestQuestion: latest.text,
        simpleEnglish,
      })

      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(latest.text),
      ])

      let buffer = ''

      try {
        for await (const chunk of stream) {
          const token = typeof chunk.content === 'string' ? chunk.content : ''
          if (!token) continue

          buffer += token

          // 🔥 Flush early for real-time UX
          if (buffer.length >= STREAM_FLUSH_CHARS || /[.!?\n]/.test(token)) {
            yield buffer
            buffer = ''
          }
        }

        if (buffer) yield buffer
      } catch (streamError) {
        console.error('Stream iteration error:', streamError)
        // Yield any buffered content before throwing
        if (buffer) yield buffer
        throw new Error('Streaming interrupted: ' + (streamError instanceof Error ? streamError.message : 'Unknown error'))
      }
    } catch (error) {
      console.error('LangChain streaming error:', error)
      throw new Error('AI analysis failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  /* ======================================================
     PROMPT BUILDER
  ====================================================== */

  private buildSystemPrompt(opts: {
    transcripts: TranscriptEntry[]
    interviewContext?: InterviewContext
    latestQuestion: string
    simpleEnglish?: boolean
  }): string {
    const conversation = this.formatConversation(opts.transcripts)

    return buildInterviewSystemPrompt({
      simpleEnglish: opts.simpleEnglish,
      context: opts.interviewContext,
      conversationHistory: conversation,
      question: opts.latestQuestion,
    })
  }

  private formatConversation(transcripts: TranscriptEntry[]): string {
    return transcripts
      .slice(-MAX_HISTORY)
      .map(t => `${t.speaker === 'user' ? 'Candidate' : 'System'}: ${t.text}`)
      .join('\n')
  }

  /* ======================================================
     UTILITIES
  ====================================================== */

  private getLLM(model: string): BaseChatModel {
    // Check cache and update access order
    if (this.llmCache.has(model)) {
      this.updateCacheAccess(model)
      return this.llmCache.get(model)!
    }

    // Create new LLM instance
    const maxTokens = Number(process.env.AI_MAX_TOKENS ?? 1200)
    let llm: BaseChatModel

    if (model.startsWith('gemini')) {
      llm = new ChatGoogleGenerativeAI({
        model,
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        apiKey: process.env.GOOGLE_API_KEY!,
        streaming: true,
      })
    } else {
      llm = new ChatOpenAI({
        modelName: model,
        temperature: 0.7,
        maxTokens,
        openAIApiKey: process.env.OPENAI_API_KEY!,
        streaming: true,
        timeout: 30_000,
      })
    }

    // Add to cache with LRU eviction
    this.addToCache(model, llm)
    return llm
  }

  /**
   * Add LLM to cache with LRU eviction
   */
  private addToCache(model: string, llm: BaseChatModel) {
    // Evict least recently used if cache is full
    if (this.llmCache.size >= MAX_CACHE_SIZE) {
      const lruModel = this.cacheAccessOrder.shift()
      if (lruModel) {
        this.llmCache.delete(lruModel)
      }
    }

    this.llmCache.set(model, llm)
    this.cacheAccessOrder.push(model)
  }

  /**
   * Update cache access order for LRU
   */
  private updateCacheAccess(model: string) {
    const index = this.cacheAccessOrder.indexOf(model)
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1)
      this.cacheAccessOrder.push(model)
    }
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.llmCache.clear()
    this.cacheAccessOrder.length = 0
  }
}

/* ======================================================
   SINGLETON
====================================================== */

export const langchainService = new LangChainService()