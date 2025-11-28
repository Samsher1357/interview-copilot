'use client'

import { CleanInterviewUI } from '@/components/CleanInterviewUI'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Home() {
  return (
    <ErrorBoundary>
      <main>
        <CleanInterviewUI />
      </main>
    </ErrorBoundary>
  )
}

