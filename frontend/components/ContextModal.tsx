'use client'

import { useState, useEffect, useRef } from 'react'
import { useInterviewStore, InterviewContext } from '@/lib/store'
import { apiClient } from '@/lib/apiClient'
import { X, Briefcase, Building2, Code, GraduationCap, Award, FileText, Upload, Loader2 } from 'lucide-react'

export function ContextModal() {
  const { interviewContext, showContextModal, setInterviewContext, setShowContextModal } = useInterviewStore()
  
  const [formData, setFormData] = useState<InterviewContext>({
    jobRole: '',
    company: '',
    skills: [],
    experience: '',
    education: '',
    achievements: '',
    customNotes: '',
  })
  
  const [skillsInput, setSkillsInput] = useState('')
  const [isParsingResume, setIsParsingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showContextModal) {
      setFormData(interviewContext)
      setSkillsInput(interviewContext.skills?.join(', ') || '')
      setResumeError(null)
    }
  }, [showContextModal, interviewContext])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const isText = file.type.includes('text') || file.name.endsWith('.txt')

    if (!isPDF && !isText) {
      setResumeError('Please upload a PDF or text file')
      return
    }

    setIsParsingResume(true)
    setResumeError(null)

    try {
      let parsed: any

      if (isPDF) {
        // Parse PDF
        const formData = new FormData()
        formData.append('file', file)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await fetch(`${apiUrl}/api/parse-pdf`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to parse PDF')
        }

        parsed = await response.json()
      } else {
        // Read text file
        const text = await file.text()

        if (text.length < 50) {
          setResumeError('Resume text is too short. Please ensure the file contains your resume content.')
          setIsParsingResume(false)
          return
        }

        // Parse text resume via backend API
        const result = await apiClient.parseResume(text)
        parsed = result.context
      }

      // Update form with parsed data
      setFormData({
        jobRole: parsed.jobRole || formData.jobRole,
        company: parsed.company || formData.company,
        skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : formData.skills,
        experience: parsed.experience || formData.experience,
        education: parsed.education || formData.education,
        achievements: parsed.achievements || formData.achievements,
        customNotes: parsed.customNotes || formData.customNotes,
      })
      
      if (parsed.skills && parsed.skills.length > 0) {
        setSkillsInput(parsed.skills.join(', '))
      }
    } catch (error: any) {
      console.error('Resume parsing error:', error)
      setResumeError(error.message || 'Failed to parse resume. Please try pasting the text manually.')
    } finally {
      setIsParsingResume(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePasteResume = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.length < 50) {
        setResumeError('Text is too short. Please copy more content from your resume.')
        return
      }

      setIsParsingResume(true)
      setResumeError(null)

      // Parse via backend API
      const result = await apiClient.parseResume(text)
      const parsed = result.context
      
      setFormData({
        jobRole: parsed.jobRole || formData.jobRole,
        company: parsed.company || formData.company,
        skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : formData.skills,
        experience: parsed.experience || formData.experience,
        education: parsed.education || formData.education,
        achievements: parsed.achievements || formData.achievements,
        customNotes: parsed.customNotes || formData.customNotes,
      })
      
      if (parsed.skills && parsed.skills.length > 0) {
        setSkillsInput(parsed.skills.join(', '))
      }
    } catch (error: any) {
      console.error('Resume parsing error:', error)
      setResumeError(error.message || 'Failed to parse resume from clipboard.')
    } finally {
      setIsParsingResume(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const skills = skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const updatedContext = { ...formData, skills }
    setInterviewContext(updatedContext)
    setShowContextModal(false)
  }

  const handleClose = () => {
    setShowContextModal(false)
  }

  if (!showContextModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Interview Context
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Resume Upload Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Quick Setup from Resume
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Upload your resume or paste text to automatically fill in your information
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.text/plain,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="resume-upload"
              />
              <label
                htmlFor="resume-upload"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors touch-manipulation"
              >
                {isParsingResume ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Resume (PDF/TXT)
                  </>
                )}
              </label>
              <button
                type="button"
                onClick={handlePasteResume}
                disabled={isParsingResume}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {isParsingResume ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Paste from Clipboard
                  </>
                )}
              </button>
            </div>
            {resumeError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{resumeError}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Briefcase className="w-4 h-4" />
              Job Role / Position
            </label>
            <input
              type="text"
              value={formData.jobRole || ''}
              onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })}
              placeholder="e.g., Senior Software Engineer, Product Manager"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Building2 className="w-4 h-4" />
              Company Name
            </label>
            <input
              type="text"
              value={formData.company || ''}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="e.g., Google, Microsoft, Startup Inc."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Code className="w-4 h-4" />
              Key Skills (comma-separated)
            </label>
            <input
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g., React, Node.js, Python, AWS, Docker"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Separate multiple skills with commas
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4" />
              Professional Experience
            </label>
            <textarea
              value={formData.experience || ''}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="Brief summary of your relevant work experience, years of experience, key projects, etc."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <GraduationCap className="w-4 h-4" />
              Education
            </label>
            <textarea
              value={formData.education || ''}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              placeholder="e.g., BS in Computer Science from MIT, Master's in Business Administration"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Award className="w-4 h-4" />
              Key Achievements
            </label>
            <textarea
              value={formData.achievements || ''}
              onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
              placeholder="Notable achievements, awards, certifications, publications, etc."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4" />
              Additional Notes
            </label>
            <textarea
              value={formData.customNotes || ''}
              onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
              placeholder="Any other relevant information about the role, company culture, specific requirements, etc."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors touch-manipulation"
            >
              Save Context
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

