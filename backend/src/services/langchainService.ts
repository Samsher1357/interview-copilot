import '../config/env'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { Turn, InterviewContext } from '../types'
import { buildSystemPrompt } from '../ai/promptBuilder'

const DEFAULT_MODEL = 'gpt-4o-mini'
const STREAM_FLUSH_CHARS = 8
const STREAM_FLUSH_INTERVAL_MS = 50
const MAX_CACHE_SIZE = 10

export class LangChainService {
  private readonly llmCache = new Map<string, BaseChatModel>()
  private readonly cacheAccessOrder: string[] = []

  constructor() {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      throw new Error('Missing AI API keys')
    }
  }

  async *streamAnalysis(
    turns: Turn[],
    utteranceText: string,
    language = 'en',
    interviewContext?: InterviewContext,
    simpleEnglish = false,
    aiModel = DEFAULT_MODEL
  ): AsyncGenerator<string> {
    if (!utteranceText?.trim()) return

    try {
      const llm = this.getLLM(aiModel)

      const systemPrompt = buildSystemPrompt({
        language,
        simpleEnglish,
        context: interviewContext,
        turns,
        utteranceText,
      })

      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(utteranceText),
      ])

      let buffer = ''
      let lastFlushTime = Date.now()

      try {
        for await (const chunk of stream) {
          const token = typeof chunk.content === 'string' ? chunk.content : ''
          if (!token) continue

          buffer += token
          const now = Date.now()
          const timeSinceLastFlush = now - lastFlushTime

          const shouldFlush =
            buffer.length >= STREAM_FLUSH_CHARS ||
            timeSinceLastFlush >= STREAM_FLUSH_INTERVAL_MS ||
            /[.!?\n]/.test(token)

          if (shouldFlush) {
            yield buffer
            buffer = ''
            lastFlushTime = now
          }
        }

        if (buffer) yield buffer
      } catch (streamError) {
        if (buffer) yield buffer
        throw new Error('Streaming interrupted: ' + (streamError instanceof Error ? streamError.message : 'Unknown'))
      }
    } catch (error) {
      console.error('LangChain streaming error:', error)
      throw new Error('AI analysis failed: ' + (error instanceof Error ? error.message : 'Unknown'))
    }
  }

  private getLLM(model: string): BaseChatModel {
    if (this.llmCache.has(model)) {
      this.updateCacheAccess(model)
      return this.llmCache.get(model)!
    }

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

    this.addToCache(model, llm)
    return llm
  }

  private addToCache(model: string, llm: BaseChatModel) {
    if (this.llmCache.size >= MAX_CACHE_SIZE) {
      const lruModel = this.cacheAccessOrder.shift()
      if (lruModel) this.llmCache.delete(lruModel)
    }
    this.llmCache.set(model, llm)
    this.cacheAccessOrder.push(model)
  }

  private updateCacheAccess(model: string) {
    const index = this.cacheAccessOrder.indexOf(model)
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1)
      this.cacheAccessOrder.push(model)
    }
  }

  clearCache() {
    this.llmCache.clear()
    this.cacheAccessOrder.length = 0
  }
}

export const langchainService = new LangChainService()
