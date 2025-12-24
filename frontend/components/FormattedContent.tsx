'use client'

import { useMemo } from 'react'

interface FormattedContentProps {
  content: string
  className?: string
}

function processInlineCode(text: string): Array<{ type: 'text' | 'inline-code'; content: string }> {
    const parts: Array<{ type: 'text' | 'inline-code'; content: string }> = []
    const inlineCodeRegex = /`([^`\n]+)`/g
    let match
    let lastIndex = 0

    while ((match = inlineCodeRegex.exec(text)) !== null) {
      // Add text before inline code
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index)
        if (textBefore.trim()) {
          parts.push({ type: 'text', content: textBefore })
        }
      }

      // Add inline code
      parts.push({
        type: 'inline-code',
        content: match[1],
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const textAfter = text.substring(lastIndex)
      if (textAfter.trim()) {
        parts.push({ type: 'text', content: textAfter })
      }
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }]
  }

export function FormattedContent({ content, className = '' }: Readonly<FormattedContentProps>) {
  const formattedContent = useMemo(() => {
    if (!content) return [{ type: 'text' as const, content: '' }]

    // Split content by code blocks (```code``` or `code`)
    const parts: Array<{ type: 'text' | 'code' | 'inline-code'; content: string; language?: string }> = []
    let remaining = content
    let lastIndex = 0

    // Match code blocks with ```language\ncode\n``` or ```code```
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
    let match

    while ((match = codeBlockRegex.exec(remaining)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = remaining.substring(lastIndex, match.index)
        if (textBefore.trim()) {
          // Process inline code in text before
          const processedText = processInlineCode(textBefore)
          parts.push(...processedText)
        }
      }

      // Add code block
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'text',
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < remaining.length) {
      const textAfter = remaining.substring(lastIndex)
      if (textAfter.trim()) {
        // Process inline code in remaining text
        const processedText = processInlineCode(textAfter)
        parts.push(...processedText)
      }
    }

    // If no code blocks found, process entire content for inline code
    if (parts.length === 0) {
      return processInlineCode(remaining)
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: remaining }]
  }, [content])

  return (
    <div className={className}>
      {formattedContent.map((part, index) => {
        if (part.type === 'code') {
          const codePart = part as { type: 'code'; content: string; language?: string }
          return (
            <pre
              key={codePart.content + codePart.language}
              className="bg-gray-900 dark:bg-gray-800 text-gray-100 dark:text-gray-200 rounded-lg p-3 sm:p-4 my-2 sm:my-3 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed border border-gray-700 dark:border-gray-600 shadow-inner"
            >
              {codePart.language && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">
                  {codePart.language}
                </div>
              )}
              <code className="block whitespace-pre-wrap break-words">{codePart.content}</code>
            </pre>
          )
        } else if (part.type === 'inline-code') {
          return (
            <code
              key={part.content}
              className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
            >
              {part.content}
            </code>
          )
        } else {
          // Process text with bullet points, highlights, and numbered lists
          const lines = part.content.split('\n')
          const processedLines: JSX.Element[] = []
          lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim()
            // Check for sub-bullets (indented with spaces or tabs)
            if (/^(\s{2,}|\t)[-*•]\s+/.test(trimmedLine)) {
              const content = trimmedLine.replace(/^(\s{2,}|\t)[-*•]\s+/, '')
              const processedContent = processHighlights(content)
              processedLines.push(
                <div key={content} className="flex items-start gap-2 my-0.5 ml-6">
                  <span className="text-primary-500 dark:text-primary-400 mt-1 text-xs">◦</span>
                  <span className="text-sm">{processedContent}</span>
                </div>
              )
            }
            // Check for bullet points (-, *, •)
            else if (/^[-*•]\s+/.test(trimmedLine)) {
              const content = trimmedLine.replace(/^[-*•]\s+/, '')
              const processedContent = processHighlights(content)
              processedLines.push(
                <div key={content} className="flex items-start gap-2 my-1.5">
                  <span className="text-primary-600 dark:text-primary-400 mt-1 font-bold text-lg">•</span>
                  <span className="flex-1">{processedContent}</span>
                </div>
              )
            }
            // Check for numbered lists (1., 2., etc.)
            else if (/^\d+\.\s+/.test(trimmedLine)) {
              const match = /^\d+\.\s+(.+)/.exec(trimmedLine)
              if (match) {
                const processedContent = processHighlights(match[1])
                processedLines.push(
                  <div key={match[1]} className="flex items-start gap-2 my-1.5">
                    <span className="text-primary-600 dark:text-primary-400 font-bold text-base">{trimmedLine.split('.')[0]}.</span>
                    <span className="flex-1">{processedContent}</span>
                  </div>
                )
              }
            }
            // Regular paragraph
            else if (trimmedLine.length > 0) {
              const processedContent = processHighlights(trimmedLine)
              processedLines.push(
                <p key={trimmedLine} className={lineIndex > 0 ? 'mt-3 mb-2' : 'mb-2'}>
                  {processedContent}
                </p>
              )
            }
            // Empty line - add spacing
            else if (lineIndex < lines.length - 1) {
              processedLines.push(<div key={`empty-line-${trimmedLine}`} className="h-2" />)
            }
          })
          return <div key={part.content}>{processedLines}</div>
        }
      })}
    </div>
  )
}

// Process highlights: **bold** and ==highlight==
function processHighlights(text: string): JSX.Element {
  const parts: Array<{ type: 'text' | 'bold' | 'highlight'; content: string }> = []
  let remaining = text
  let lastIndex = 0

  // Match ==highlight== first (higher priority)
  const highlightRegex = /==([^=]+)==/g
  let match
  const highlights: Array<{ start: number; end: number; content: string }> = []

  while ((match = highlightRegex.exec(remaining)) !== null) {
    highlights.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    })
  }

  // Match **bold**
  const boldRegex = /\*\*([^*]+)\*\*/g
  const bolds: Array<{ start: number; end: number; content: string }> = []

  while ((match = boldRegex.exec(remaining)) !== null) {
    bolds.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    })
  }

  // Combine and sort all matches
  const allMatches = [
    ...highlights.map(h => ({ ...h, type: 'highlight' as const })),
    ...bolds.map(b => ({ ...b, type: 'bold' as const })),
  ].sort((a, b) => a.start - b.start)

  // Process matches
  allMatches.forEach((match) => {
    // Add text before match
    if (match.start > lastIndex) {
      const textBefore = remaining.substring(lastIndex, match.start)
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore })
      }
    }

    // Add match
    parts.push({ type: match.type, content: match.content })

    lastIndex = match.end
  })

  // Add remaining text
  if (lastIndex < remaining.length) {
    const textAfter = remaining.substring(lastIndex)
    if (textAfter) {
      parts.push({ type: 'text', content: textAfter })
    }
  }

  // If no matches, return plain text
  if (parts.length === 0) {
    return <>{text}</>
  }

  return (
    <>
      {parts.map((part) => {
        if (part.type === 'bold') {
          return <strong key={part.content} className="font-bold text-gray-900 dark:text-gray-100">{part.content}</strong>
        } else if (part.type === 'highlight') {
          return (
            <mark key={part.content} className="bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-gray-100 px-1 rounded font-semibold">
              {part.content}
            </mark>
          )
        } else {
          return <span key={part.content}>{part.content}</span>
        }
      })}
    </>
  )
}

