'use client'

import { InterviewCopilot } from '@/components/InterviewCopilot'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Home() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen p-4 md:p-8">
        <InterviewCopilot />
      </main>
    </ErrorBoundary>
  )
}

