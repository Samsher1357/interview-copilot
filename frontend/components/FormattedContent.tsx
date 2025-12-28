'use client'

import { useMemo } from 'react'

interface FormattedContentProps {
  content: string
  className?: string
}

/* ======================================================
   TYPES
====================================================== */

type Block =
  | { type: 'text'; content: string }
  | { type: 'inline-code'; content: string }
  | { type: 'code'; content: string; language?: string }

/* ======================================================
   PARSERS (PURE FUNCTIONS)
====================================================== */

/**
 * Extract Question / Answer deterministically
 */
function parseQA(content: string): { question: string | null; answer: string } {
  if (!content) return { question: null, answer: '' }

  const qMatch = content.match(/(?:💬\s*)?Question:\s*(.+?)(?=\n|$)/i)
  const aMatch = content.match(/(?:⭐\s*)?Answer:\s*([\s\S]*)/i)

  if (!qMatch) {
    return { question: null, answer: content.trim() }
  }

  return {
    question: qMatch[1].trim(),
    answer: (aMatch?.[1] ?? '').trim(),
  }
}

/**
 * Parse code blocks + inline code in one pass
 */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text))) {
    if (match.index > lastIndex) {
      blocks.push(...parseInline(text.slice(lastIndex, match.index)))
    }

    blocks.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || 'text',
    })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    blocks.push(...parseInline(text.slice(lastIndex)))
  }

  return blocks.length ? blocks : [{ type: 'text', content: text }]
}

/**
 * Inline code parser
 */
function parseInline(text: string): Block[] {
  const parts: Block[] = []
  const regex = /`([^`\n]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'inline-code', content: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text', content: text }]
}

/* ======================================================
   TEXT FORMATTERS
====================================================== */

function renderHighlights(text: string): JSX.Element {
  const regex = /(==[^=]+==)|(\*\*[^*]+\*\*)/g
  const parts: JSX.Element[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>)
    }

    if (match[1]) {
      parts.push(
        <mark
          key={match.index}
          className="bg-yellow-200 dark:bg-yellow-900/40 px-1 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold text-yellow-900 dark:text-yellow-100"
        >
          {match[1].slice(2, -2)}
        </mark>
      )
    } else {
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900 dark:text-slate-50">
          {match[2].slice(2, -2)}
        </strong>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

/* ======================================================
   COMPONENT
====================================================== */

export function FormattedContent({
  content,
  className = '',
}: Readonly<FormattedContentProps>) {
  const { question, answer } = useMemo(() => parseQA(content), [content])

  const blocks = useMemo(() => parseBlocks(answer), [answer])

  return (
    <div className={`${className} space-y-3`}>
      {/* Question */}
      {question && (
        <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-1.5 sm:gap-2 items-start">
            <span className="text-base sm:text-lg flex-shrink-0">💬</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Question</div>
              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{question}</p>
            </div>
          </div>
        </div>
      )}

      {/* Answer header */}
      {question && (
        <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 items-center">
          <span className="text-base sm:text-lg flex-shrink-0">⭐</span>
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Answer</div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-2 sm:space-y-3">
        {blocks.map((block, i) => {
          if (block.type === 'code') {
            return (
              <pre
                key={i}
                className="bg-gray-900 text-gray-100 rounded-md sm:rounded-lg p-3 sm:p-4 my-3 sm:my-4 text-[11px] sm:text-xs md:text-sm overflow-x-auto shadow-lg border border-gray-700"
              >
                {block.language && (
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-2 uppercase font-semibold tracking-wider">
                    {block.language}
                  </div>
                )}
                <code className="leading-relaxed">{block.content}</code>
              </pre>
            )
          }

          if (block.type === 'inline-code') {
            return (
              <code
                key={i}
                className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-1 sm:px-1.5 py-0.5 rounded font-mono text-[11px] sm:text-xs font-semibold"
              >
                {block.content}
              </code>
            )
          }

          // Text block → bullets / paragraphs
          return (
            <div key={i} className="space-y-1.5 sm:space-y-2">
              {block.content.split('\n').map((line, idx) => {
                const t = line.trim()
                if (!t) return <div key={idx} className="h-1 sm:h-2" />

                if (/^[-•*]\s+/.test(t)) {
                  return (
                    <div key={idx} className="flex gap-1.5 sm:gap-2 my-1.5 sm:my-2 items-start">
                      <span className="text-purple-600 dark:text-purple-400 font-bold text-xs sm:text-sm flex-shrink-0 leading-relaxed">•</span>
                      <span className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 flex-1">
                        {renderHighlights(t.replace(/^[-•*]\s+/, ''))}
                      </span>
                    </div>
                  )
                }

                if (/^\d+\.\s+/.test(t)) {
                  const [num, rest] = t.split('.', 2)
                  return (
                    <div key={idx} className="flex gap-1.5 sm:gap-2 my-1.5 sm:my-2 items-start">
                      <span className="font-bold text-purple-600 dark:text-purple-400 text-xs sm:text-sm flex-shrink-0 leading-relaxed">{num}.</span>
                      <span className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 flex-1">
                        {renderHighlights(rest.trim())}
                      </span>
                    </div>
                  )
                }

                return (
                  <p key={idx} className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 mb-2 sm:mb-3">
                    {renderHighlights(t)}
                  </p>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}