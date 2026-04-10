-- Create minimal schema for testing
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
);

-- Test table
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT 'Schema created successfully!' as message;

-- ─────────────────────────────────────────────
-- Story Examples
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_examples (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  story_id           TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_message       TEXT NOT NULL DEFAULT '',
  assistant_message  TEXT NOT NULL DEFAULT '',
  "order"            INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_story_examples_story_id ON story_examples(story_id);

-- StoryStatus DRAFT 추가 (enum 값은 ALTER TYPE으로 추가)
DO $$ BEGIN
  ALTER TYPE "StoryStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ONGOING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
