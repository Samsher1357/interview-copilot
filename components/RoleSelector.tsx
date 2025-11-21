'use client'

import { useInterviewStore } from '@/lib/store'
import { UserRole } from '@/lib/services/AIAnalysisService'
import { UserCircle, Users, Briefcase } from 'lucide-react'

export function RoleSelector() {
  const { userRole, setUserRole, isListening } = useInterviewStore()

  const roles: { value: UserRole; label: string; icon: React.ReactNode; description: string; color: string }[] = [
    {
      value: 'applicant',
      label: 'Applicant',
      icon: <UserCircle className="w-5 h-5" />,
      description: 'Get help answering interview questions',
      color: 'blue',
    },
    {
      value: 'interviewer',
      label: 'Interviewer',
      icon: <Briefcase className="w-5 h-5" />,
      description: 'Get insights and follow-up questions',
      color: 'purple',
    },
    {
      value: 'both',
      label: 'Both',
      icon: <Users className="w-5 h-5" />,
      description: 'Comprehensive assistance for both parties',
      color: 'emerald',
    },
  ]

  const getColorClasses = (roleValue: UserRole, isSelected: boolean) => {
    const colors = roles.find(r => r.value === roleValue)?.color || 'blue'
    
    if (isSelected) {
      return {
        bg: `bg-${colors}-100 dark:bg-${colors}-900/40`,
        border: `border-${colors}-500 dark:border-${colors}-400`,
        text: `text-${colors}-700 dark:text-${colors}-300`,
        ring: `ring-${colors}-500 dark:ring-${colors}-400`,
      }
    }
    
    return {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-600 dark:text-gray-400',
      ring: 'ring-gray-300 dark:ring-gray-600',
    }
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          I am the...
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select your role to get tailored assistance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {roles.map((role) => {
          const isSelected = userRole === role.value
          const colorClasses = getColorClasses(role.value, isSelected)
          
          return (
            <button
              key={role.value}
              onClick={() => !isListening && setUserRole(role.value)}
              disabled={isListening}
              className={`
                relative flex flex-col items-start p-4 rounded-xl border-2 transition-all
                ${isSelected ? colorClasses.bg : colorClasses.bg}
                ${isSelected ? colorClasses.border : colorClasses.border}
                ${isListening ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}
                ${isSelected ? 'ring-2 ring-offset-2' : ''}
                ${isSelected ? colorClasses.ring : ''}
              `}
            >
              <div className={`flex items-center gap-2 mb-2 ${isSelected ? colorClasses.text : colorClasses.text}`}>
                {role.icon}
                <span className="font-semibold text-sm">{role.label}</span>
              </div>
              <p className={`text-xs ${isSelected ? colorClasses.text : 'text-gray-500 dark:text-gray-400'}`}>
                {role.description}
              </p>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className={`w-2 h-2 rounded-full ${colorClasses.bg} ring-2 ${colorClasses.ring}`} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {isListening && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <span className="w-1.5 h-1.5 bg-amber-600 dark:bg-amber-400 rounded-full animate-pulse" />
          Role cannot be changed while listening
        </div>
      )}
    </div>
  )
}

