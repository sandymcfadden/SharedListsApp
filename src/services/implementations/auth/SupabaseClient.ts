import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseClientSingleton {
  private static instance: SupabaseClient | null = null;
  private static url: string | null = null;
  private static key: string | null = null;

  static getInstance(
    supabaseUrl: string,
    supabaseAnonKey: string
  ): SupabaseClient {
    // If we already have an instance with the same URL and key, return it
    if (
      SupabaseClientSingleton.instance &&
      SupabaseClientSingleton.url === supabaseUrl &&
      SupabaseClientSingleton.key === supabaseAnonKey
    ) {
      return SupabaseClientSingleton.instance;
    }

    // Create new instance
    SupabaseClientSingleton.instance = createClient(
      supabaseUrl,
      supabaseAnonKey
    );
    SupabaseClientSingleton.url = supabaseUrl;
    SupabaseClientSingleton.key = supabaseAnonKey;

    return SupabaseClientSingleton.instance;
  }

  static reset(): void {
    SupabaseClientSingleton.instance = null;
    SupabaseClientSingleton.url = null;
    SupabaseClientSingleton.key = null;
  }

  static hasInstance(): boolean {
    return SupabaseClientSingleton.instance !== null;
  }
}
