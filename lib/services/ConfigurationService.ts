/**
 * Configuration Service
 * Centralized configuration management for the interview copilot
 * Handles settings, preferences, and runtime configuration
 */

import { UserRole } from './AIAnalysisService'

export interface AppConfiguration {
  // User role settings
  userRole: UserRole
  
  // Transcription settings
  transcription: {
    language: string
    model: string
    diarize: boolean
    punctuate: boolean
    smartFormat: boolean
  }
  
  // AI settings
  ai: {
    provider: 'openai' | 'gemini'
    model: string
    maxTokens: number
    temperature: number
    streamingEnabled: boolean
  }
  
  // UI settings
  ui: {
    autoSpeak: boolean
    theme: 'light' | 'dark' | 'system'
    compactMode: boolean
  }
  
  // Feature flags
  features: {
    realtimeSync: boolean
    multiUser: boolean
    advancedAnalytics: boolean
  }
}

const DEFAULT_CONFIG: AppConfiguration = {
  userRole: 'applicant',
  
  transcription: {
    language: 'en-US',
    model: 'nova-2',
    diarize: true,
    punctuate: true,
    smartFormat: true,
  },
  
  ai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 1200,
    temperature: 0.7,
    streamingEnabled: true,
  },
  
  ui: {
    autoSpeak: false,
    theme: 'system',
    compactMode: false,
  },
  
  features: {
    realtimeSync: true,
    multiUser: false,
    advancedAnalytics: false,
  },
}

export class ConfigurationService {
  private config: AppConfiguration
  private listeners: Map<string, Set<(config: AppConfiguration) => void>>

  constructor(initialConfig?: Partial<AppConfiguration>) {
    this.config = { ...DEFAULT_CONFIG, ...initialConfig }
    this.listeners = new Map()
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<AppConfiguration> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AppConfiguration>): void {
    this.config = {
      ...this.config,
      ...updates,
      // Deep merge nested objects
      transcription: { ...this.config.transcription, ...updates.transcription },
      ai: { ...this.config.ai, ...updates.ai },
      ui: { ...this.config.ui, ...updates.ui },
      features: { ...this.config.features, ...updates.features },
    }
    
    this.notifyListeners()
  }

  /**
   * Update user role
   */
  setUserRole(role: UserRole): void {
    this.config.userRole = role
    this.notifyListeners()
  }

  /**
   * Get user role
   */
  getUserRole(): UserRole {
    return this.config.userRole
  }

  /**
   * Update language
   */
  setLanguage(language: string): void {
    this.config.transcription.language = language
    this.notifyListeners()
  }

  /**
   * Get language
   */
  getLanguage(): string {
    return this.config.transcription.language
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(key: string, callback: (config: AppConfiguration) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    
    this.listeners.get(key)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((callbacks) => {
      callbacks.forEach((callback) => {
        try {
          callback(this.config)
        } catch (error) {
          console.error('Error in configuration listener:', error)
        }
      })
    })
  }

  /**
   * Load configuration from localStorage
   */
  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('interview-copilot-config')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.updateConfig(parsed)
      }
    } catch (error) {
      console.error('Failed to load configuration from storage:', error)
    }
  }

  /**
   * Save configuration to localStorage
   */
  saveToStorage(): void {
    try {
      localStorage.setItem('interview-copilot-config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save configuration to storage:', error)
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.notifyListeners()
    this.saveToStorage()
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /**
   * Import configuration from JSON
   */
  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      this.updateConfig(parsed)
      this.saveToStorage()
      return true
    } catch (error) {
      console.error('Failed to import configuration:', error)
      return false
    }
  }
}

// Singleton instance
export const configService = new ConfigurationService()

