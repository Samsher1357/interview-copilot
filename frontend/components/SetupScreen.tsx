'use client'

import { useState, useEffect, useRef } from 'react'
import { useInterviewStore, InterviewContext } from '@/lib/store'
import { apiClient } from '@/lib/apiClient'
import { 
  Briefcase, Building2, Code, GraduationCap, Award, FileText, 
  Upload, Loader2, Play, Settings, Brain
} from 'lucide-react'

interface SetupScreenProps {
  onStart: () => void
}

export function SetupScreen({ onStart }: Readonly<SetupScreenProps>) {
  const { 
    interviewContext, 
    setInterviewContext,
    simpleEnglish,
    setSimpleEnglish,
    aiModel,
    setAiModel
  } = useInterviewStore()
  
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
  const [parsingProgress, setParsingProgress] = useState<string>('')
  const [resumeError, setResumeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFormData(interviewContext)
    setSkillsInput(interviewContext.skills?.join(', ') || '')
  }, [interviewContext])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const isText = file.type.includes('text') || file.name.endsWith('.txt')

    if (!isPDF && !isText) {
      setResumeError('Please upload a PDF or text file')
      return
    }

    setIsParsingResume(true)
    setResumeError(null)
    setParsingProgress('Reading file...')

    try {
      let parsed: any

      if (isPDF) {
        setParsingProgress('Extracting text from PDF...')
        const formData = new FormData()
        formData.append('file', file)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        setParsingProgress('Uploading PDF...')
        const response = await fetch(`${apiUrl}/api/resume/pdf`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to parse PDF')
        }

        setParsingProgress('Analyzing resume content...')
        parsed = await response.json()
      } else {
        setParsingProgress('Reading text file...')
        const text = await file.text()

        if (text.length < 50) {
          setResumeError('Resume text is too short. Please ensure the file contains your resume content.')
          setIsParsingResume(false)
          return
        }

        setParsingProgress('Analyzing resume content...')
        const result = await apiClient.parseResume(text)
        parsed = result.context
      }

      setParsingProgress('Populating fields...')
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
      
      // Show success toast
      const { showToast } = useInterviewStore.getState()
      showToast('success', 'Resume Parsed!', 'Your information has been extracted successfully')
    } catch (error: any) {
      console.error('Resume parsing error:', error)
      setResumeError(error.message || 'Failed to parse resume. Please try pasting the text manually.')
      const { showToast } = useInterviewStore.getState()
      showToast('error', 'Parsing Failed', error.message || 'Failed to parse resume')
    } finally {
      setIsParsingResume(false)
      setParsingProgress('')
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

  const handleStartInterview = () => {
    const skills = skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const updatedContext = { ...formData, skills }
    setInterviewContext(updatedContext)
    onStart()
  }

  const handleSkipSetup = () => {
    onStart()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-glow mb-4">
            <Settings className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gradient mb-2">
            Interview Setup
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            Configure your session for personalized AI assistance
          </p>
        </div>

        <div className="card overflow-hidden">
          {/* Quick Settings Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Quick Settings</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* AI Model */}
              <div className="glass-effect rounded-xl p-4 border border-white/20">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Brain className="w-4 h-4" />
                  AI Model
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                  aria-label="Select AI model"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                  <option value="gpt-4.1">GPT-4.1 (Advanced)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>

              {/* Simple English */}
              <div className="glass-effect rounded-xl p-4 border border-white/20">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <FileText className="w-4 h-4" />
                  Simple English
                </label>
                <button
                  onClick={() => setSimpleEnglish(!simpleEnglish)}
                  className={`w-full px-3 py-2.5 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    simpleEnglish
                      ? 'bg-white text-purple-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  aria-label={`Simple English ${simpleEnglish ? 'enabled' : 'disabled'}`}
                >
                  {simpleEnglish ? '✓ Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin">
            {/* Resume Upload Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 animate-slide-up">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Quick Setup from Resume
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Upload your resume (PDF/TXT) or paste text to auto-fill your information
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.text/plain,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resume-upload"
                  aria-label="Upload resume file"
                />
                <label
                  htmlFor="resume-upload"
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 min-h-[44px] ${
                    isParsingResume ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isParsingResume ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs sm:text-sm">{parsingProgress || 'Parsing...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span className="text-xs sm:text-sm">Upload Resume</span>
                    </>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handlePasteResume}
                  disabled={isParsingResume}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  aria-label="Paste resume text from clipboard"
                >
                  {isParsingResume ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs sm:text-sm">Parsing...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span className="text-xs sm:text-sm">Paste Text</span>
                    </>
                  )}
                </button>
              </div>
              {resumeError && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">{resumeError}</p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Job Role / Position
                </label>
                <input
                  type="text"
                  value={formData.jobRole || ''}
                  onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })}
                  placeholder="e.g., Senior Software Engineer"
                  className="input-field"
                  aria-label="Job role or position"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company || ''}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Google, Microsoft"
                  className="input-field"
                  aria-label="Company name"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Code className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Key Skills <span className="text-xs text-slate-500">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="e.g., React, Node.js, Python, AWS"
                  className="input-field"
                  aria-label="Key skills"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Experience
                </label>
                <textarea
                  value={formData.experience || ''}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  placeholder="Brief summary of your work experience"
                  rows={2}
                  className="input-field resize-none"
                  aria-label="Work experience"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Education
                </label>
                <textarea
                  value={formData.education || ''}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  placeholder="Your educational background"
                  rows={2}
                  className="input-field resize-none"
                  aria-label="Education"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.35s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Achievements
                </label>
                <textarea
                  value={formData.achievements || ''}
                  onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                  placeholder="Notable achievements and awards"
                  rows={2}
                  className="input-field resize-none"
                  aria-label="Achievements"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Additional Notes
                </label>
                <textarea
                  value={formData.customNotes || ''}
                  onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
                  placeholder="Any other relevant information"
                  rows={2}
                  className="input-field resize-none"
                  aria-label="Additional notes"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStartInterview}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-4 text-base font-bold shadow-lg hover:shadow-xl"
                aria-label="Start interview session"
              >
                <Play className="w-5 h-5" />
                Start Interview
              </button>
              <button
                onClick={handleSkipSetup}
                className="btn-secondary py-4 text-base font-semibold"
                aria-label="Skip setup and start"
              >
                Skip Setup
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3">
              🔒 All information is stored locally and can be edited anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
