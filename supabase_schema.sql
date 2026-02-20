-- Run this script in your Supabase SQL Editor to set up the required tables

-- 1. Profiles table (for users and admins)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  phone_number TEXT,
  avatar_url TEXT,
  credits INTEGER DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Brand Settings table (for global app configuration)
CREATE TABLE IF NOT EXISTS brand_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT DEFAULT 'Kisah Ai',
  tagline TEXT DEFAULT 'by Erna',
  logo_url TEXT DEFAULT 'https://storage.googleapis.com/generativeai-downloads/images/sfx-logo.png',
  gemini_api_key TEXT,
  gemini_api_keys TEXT,
  groq_api_key TEXT,
  freepik_api_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default brand settings if not exists
INSERT INTO brand_settings (id, name, tagline, logo_url)
VALUES ('00000000-0000-0000-0000-000000000000', 'Kisah Ai', 'by Erna', 'https://storage.googleapis.com/generativeai-downloads/images/sfx-logo.png')
ON CONFLICT (id) DO NOTHING;

-- 3. Books table
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  theme TEXT,
  target_age TEXT,
  moral TEXT,
  cover_url TEXT,
  cover_prompt TEXT,
  character_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT,
  illustration_url TEXT,
  illustration_prompt TEXT,
  narration_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Profiles: Users can read all profiles (for admin list), but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Brand Settings: Only authenticated users can read, only admins can update
CREATE POLICY "Brand settings are viewable by authenticated users" ON brand_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Only admins can update brand settings" ON brand_settings FOR ALL 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Books: Users can only see and manage their own books
CREATE POLICY "Users can manage their own books" ON books FOR ALL 
  USING (auth.uid() = user_id);

-- Pages: Users can manage pages of their own books
CREATE POLICY "Users can manage pages of their own books" ON pages FOR ALL 
  USING (EXISTS (SELECT 1 FROM books WHERE id = book_id AND user_id = auth.uid()));
