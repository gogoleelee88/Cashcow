-- Initialize PostgreSQL for CharacterVerse
-- This runs once when the container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- Accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring

-- Create read-only replica user for read splitting
CREATE USER characterverse_read WITH PASSWORD 'read_replica_pass';
GRANT CONNECT ON DATABASE characterverse TO characterverse_read;
GRANT USAGE ON SCHEMA public TO characterverse_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO characterverse_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO characterverse_read;

-- Configure for full-text search
ALTER TEXT SEARCH CONFIGURATION pg_catalog.english
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, english_stem;
