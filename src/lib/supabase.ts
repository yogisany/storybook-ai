/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pfkafmtorgbashyqxfju.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBma2FmbXRvcmdiYXNoeXF4Zmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODA3OTgsImV4cCI6MjA4NzA1Njc5OH0.5u7cnVVsONQYVvYWm_z5RT5mHUNHrx598jzqWZonzoI';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Using default values for demo.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
