'use client'

import { CleanInterviewUI } from '@/components/CleanInterviewUI'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { useInterviewStore } from '@/lib/store'

export default function Home() {
  const { toasts, removeToast } = useInterviewStore()
  
  return (
    <ErrorBoundary>
      <main>
        <CleanInterviewUI />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </ErrorBoundary>
  )
}

