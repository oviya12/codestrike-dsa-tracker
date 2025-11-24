import { createClient } from '@supabase/supabase-js';

// Use environment variables for configuration
// In a real deployment, these would be set in the Vercel/Netlify dashboard
const supabaseUrl = "https://guevsgzhblyaqjfcqtuk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZXZzZ3poYmx5YXFqZmNxdHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQ0OTIsImV4cCI6MjA3OTQ4MDQ5Mn0.pi2exblpFO5KknNTPLGkqiH-RF_anHwA7ssE0S6dUsw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
