/*
  # Initial Schema for Video Platform

  This migration sets up the initial database schema for the video learning platform.

  1. New Tables
    - `users`: Stores user information, including authentication details managed by NextAuth.js.
      - `id` (uuid, primary key)
      - `name` (text, nullable)
      - `email` (text, unique, nullable)
      - `emailVerified` (timestamp, nullable)
      - `image` (text, nullable)
      - `role` (text, default 'user')
    - `accounts`: Stores linked accounts for users (used by NextAuth.js).
      - `id` (uuid, primary key)
      - `userId` (uuid, foreign key to users)
      - `type` (text)
      - `provider` (text)
      - `providerAccountId` (text)
      - `refresh_token` (text, nullable)
      - `access_token` (text, nullable)
      - `expires_at` (integer, nullable)
      - `token_type` (text, nullable)
      - `scope` (text, nullable)
      - `id_token` (text, nullable)
      - `session_state` (text, nullable)
    - `sessions`: Stores user sessions (used by NextAuth.js).
      - `id` (uuid, primary key)
      - `sessionToken` (text, unique)
      - `userId` (uuid, foreign key to users)
      - `expires` (timestamp)
    - `verification_tokens`: Stores tokens for email verification (used by NextAuth.js).
      - `identifier` (text)
      - `token` (text, unique)
      - `expires` (timestamp)
    - `courses`: Stores information about learning courses.
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, nullable)
      - `imageUrl` (text, nullable)
    - `chapters`: Stores information about chapters within courses.
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, nullable)
      - `courseId` (uuid, foreign key to courses)
    - `videos`: Stores information about videos within chapters.
      - `id` (uuid, primary key)
      - `title` (text)
      - `videoUrl` (text)
      - `chapterId` (uuid, foreign key to chapters)
      - `order` (integer, default 0)
    - `user_courses`: Links users to the courses they are enrolled in.
      - `id` (uuid, primary key)
      - `userId` (uuid, foreign key to users)
      - `courseId` (uuid, foreign key to courses)
      - `createdAt` (timestamp, default now())
    - `user_video_progress`: Tracks user progress on individual videos.
      - `id` (uuid, primary key)
      - `userId` (uuid, foreign key to users)
      - `videoId` (uuid, foreign key to videos)
      - `completed` (boolean, default false)
      - `updatedAt` (timestamp, default now(), updated at)

  2. Security
    - Enable RLS on all new tables (`users`, `accounts`, `sessions`, `verification_tokens`, `courses`, `chapters`, `videos`, `user_courses`, `user_video_progress`).
    - Add basic RLS policies (will be refined later as needed).

  3. Changes
    - No existing tables are modified.

  4. Important Notes
    - The `users`, `accounts`, `sessions`, and `verification_tokens` tables are primarily managed by NextAuth.js.
    - RLS policies provided are basic examples and should be reviewed and adjusted based on specific application requirements.
*/

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  "emailVerified" timestamptz,
  image text,
  role text NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text UNIQUE NOT NULL,
  "userId" uuid NOT NULL,
  expires timestamptz NOT NULL,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier text NOT NULL,
  token text UNIQUE NOT NULL,
  expires timestamptz NOT NULL,
  UNIQUE (identifier, token)
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  "imageUrl" text
);

CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  "courseId" uuid NOT NULL,
  FOREIGN KEY ("courseId") REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  "videoUrl" text NOT NULL,
  "chapterId" uuid NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  FOREIGN KEY ("chapterId") REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "courseId" uuid NOT NULL,
  "createdAt" timestamptz DEFAULT now(),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("courseId") REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE ("userId", "courseId")
);

CREATE TABLE IF NOT EXISTS user_video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "videoId" uuid NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  "updatedAt" timestamptz DEFAULT now(),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("videoId") REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE ("userId", "videoId")
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_progress ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (These need refinement based on your app's logic)
-- Users table policies
CREATE POLICY "Public users are viewable by everyone." ON users FOR SELECT USING (true);
-- Add policies for authenticated users to manage their own data if needed, e.g.:
-- CREATE POLICY "Authenticated users can update their own data." ON users FOR UPDATE USING (auth.uid() = id);

-- Accounts table policies (NextAuth.js manages this, typically restricted)
-- CREATE POLICY "Authenticated users can view their own accounts." ON accounts FOR SELECT USING (auth.uid() = "userId");

-- Sessions table policies (NextAuth.js manages this, typically restricted)
-- CREATE POLICY "Authenticated users can view their own sessions." ON sessions FOR SELECT USING (auth.uid() = "userId");

-- Verification Tokens table policies (NextAuth.js manages this, typically restricted)
-- No public policies needed for verification tokens

-- Courses table policies
CREATE POLICY "Courses are viewable by everyone." ON courses FOR SELECT USING (true);
-- Add policies for admin to insert, update, delete if needed

-- Chapters table policies
CREATE POLICY "Chapters are viewable by everyone." ON chapters FOR SELECT USING (true);
-- Add policies for admin to insert, update, delete if needed

-- Videos table policies
CREATE POLICY "Videos are viewable by everyone." ON videos FOR SELECT USING (true);
-- Add policies for admin to insert, update, delete if needed

-- User Courses table policies
CREATE POLICY "Authenticated users can view their own enrolled courses." ON user_courses FOR SELECT USING (auth.uid() = "userId");
-- Add policies for authenticated users to enroll/unenroll if needed

-- User Video Progress table policies
CREATE POLICY "Authenticated users can view their own video progress." ON user_video_progress FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY "Authenticated users can update their own video progress." ON user_video_progress FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "Authenticated users can insert their own video progress." ON user_video_progress FOR INSERT WITH CHECK (auth.uid() = "userId");
