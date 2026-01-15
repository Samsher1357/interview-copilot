'use client'

import { CleanInterviewUI } from '@/components/CleanInterviewUI'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { useCopilotStore } from '@/lib/store'

export default function Home() {
  const { toasts, removeToast } = useCopilotStore()
  
  return (
    <ErrorBoundary>
      <main>
        <CleanInterviewUI />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </ErrorBoundary>
  )
}

