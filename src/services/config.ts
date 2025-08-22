import { LogLevel } from '@/services/interfaces/ILogService';

export interface AppConfig {
  auth: {
    type: 'supabase';
    url: string;
    apiKey?: string;
  };
  localStorage: {
    type: 'indexeddb';
  };
  remoteStorage: {
    type: 'supabase';
  };
  realtime: {
    type: 'supabase';
  };
  logging: {
    type: 'console';
    level: LogLevel;
    enabled: boolean;
  };
}

const defaultConfig: AppConfig = {
  auth: {
    type: 'supabase',
    url: import.meta.env.VITE_SUPABASE_URL || '',
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  localStorage: {
    type: 'indexeddb',
  },
  remoteStorage: {
    type: 'supabase',
  },
  realtime: {
    type: 'supabase',
  },
  logging: {
    type: 'console',
    level: LogLevel.ERROR,
    enabled: true,
  },
};

export function getConfig(): AppConfig {
  const env = import.meta.env.MODE || 'development';

  if (env === 'production') {
    // In production, use environment variables with fallbacks
    return {
      ...defaultConfig,
      auth: {
        ...defaultConfig.auth,
        url: import.meta.env.VITE_SUPABASE_URL || defaultConfig.auth.url,
        apiKey:
          import.meta.env.VITE_SUPABASE_ANON_KEY || defaultConfig.auth.apiKey,
      },
    };
  }

  return defaultConfig;
}

// Helper function to validate configuration
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  // Validate backend configuration
  if (config.auth.type === 'supabase') {
    if (!config.auth.url) {
      errors.push('Supabase URL is required when using Supabase backend');
    }
    if (!config.auth.apiKey) {
      errors.push('Supabase API key is required when using Supabase backend');
    }
  }

  return errors;
}
