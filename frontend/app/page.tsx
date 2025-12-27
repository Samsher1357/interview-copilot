'use client'

import { useEffect } from 'react'
import { CleanInterviewUI } from '@/components/CleanInterviewUI'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { useInterviewStore } from '@/lib/store'

const CLEANUP_INTERVAL = 60000 // Cleanup every 60 seconds

export default function Home() {
  const { toasts, removeToast, cleanupOldData } = useInterviewStore()
  
  // Periodic cleanup to prevent memory growth
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupOldData()
    }, CLEANUP_INTERVAL)
    
    return () => clearInterval(interval)
  }, [cleanupOldData])
  
  return (
    <ErrorBoundary>
      <main>
        <CleanInterviewUI />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </ErrorBoundary>
  )
}

