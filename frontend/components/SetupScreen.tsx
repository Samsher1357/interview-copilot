'use client'

import { useState, useEffect, useRef } from 'react'
import { useInterviewStore, InterviewContext } from '@/lib/store'
import { apiClient } from '@/lib/apiClient'
import { 
  Briefcase, Building2, Code, GraduationCap, Award, FileText, 
  Upload, Loader2, Volume2, VolumeX, Play, Settings, Brain
} from 'lucide-react'

interface SetupScreenProps {
  onStart: () => void
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const { 
    interviewContext, 
    setInterviewContext,
    autoSpeak,
    setAutoSpeak,
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

    try {
      let parsed: any

      if (isPDF) {
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
        const text = await file.text()

        if (text.length < 50) {
          setResumeError('Resume text is too short. Please ensure the file contains your resume content.')
          setIsParsingResume(false)
          return
        }

        const result = await apiClient.parseResume(text)
        parsed = result.context
      }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl mb-4">
            <Settings className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Interview Setup
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Configure your interview session for personalized AI assistance
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Settings Tabs */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Quick Settings</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* AI Model */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Brain className="w-4 h-4" />
                  AI Model
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white/90 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-white"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>

              {/* Auto Speak */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  Auto-Speak
                </label>
                <button
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    autoSpeak
                      ? 'bg-white text-blue-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {autoSpeak ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Simple English */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <FileText className="w-4 h-4" />
                  Simple English
                </label>
                <button
                  onClick={() => setSimpleEnglish(!simpleEnglish)}
                  className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    simpleEnglish
                      ? 'bg-white text-purple-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {simpleEnglish ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {/* Resume Upload Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
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
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  {isParsingResume ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Resume
                    </>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handlePasteResume}
                  disabled={isParsingResume}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isParsingResume ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Paste Text
                    </>
                  )}
                </button>
              </div>
              {resumeError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{resumeError}</p>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Briefcase className="w-4 h-4" />
                  Job Role / Position
                </label>
                <input
                  type="text"
                  value={formData.jobRole || ''}
                  onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })}
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  placeholder="e.g., Google, Microsoft"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  placeholder="e.g., React, Node.js, Python"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4" />
                  Experience
                </label>
                <textarea
                  value={formData.experience || ''}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  placeholder="Brief summary of your work experience"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                  placeholder="Your educational background"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Award className="w-4 h-4" />
                  Achievements
                </label>
                <textarea
                  value={formData.achievements || ''}
                  onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                  placeholder="Notable achievements and awards"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                  placeholder="Any other relevant information"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStartInterview}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
              >
                <Play className="w-5 h-5" />
                Start Interview
              </button>
              <button
                onClick={handleSkipSetup}
                className="px-6 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all"
              >
                Skip Setup
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
              All information is stored locally and can be edited anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
