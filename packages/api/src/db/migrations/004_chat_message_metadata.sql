-- Migration: 004_chat_message_metadata
-- Adds structured metadata storage for chat context items.

ALTER TABLE chat_messages
  ADD COLUMN metadata_json TEXT;
