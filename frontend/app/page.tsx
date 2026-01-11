'use client'

import { CleanInterviewUI } from '@/components/CleanInterviewUI'
import { ToastContainer } from '@/components/Toast'
import { useInterviewStore } from '@/lib/store'

export default function Home() {
  const { toasts, removeToast } = useInterviewStore()
  
  return (
    <main>
      <CleanInterviewUI />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </main>
  )
}

