-- Create integration_tokens table for Outlook OAuth tokens
-- Run this in your Neon database SQL editor

CREATE TABLE IF NOT EXISTS integration_tokens (
  provider VARCHAR(100) PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_provider ON integration_tokens(provider);

