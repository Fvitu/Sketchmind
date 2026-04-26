-- Phase 3: Add sharing support

-- Add share_token column to boards (for shareable links)
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Add is_shared_with_me flag to board_members
ALTER TABLE public.board_members
  ADD COLUMN IF NOT EXISTS is_shared_with_me BOOLEAN NOT NULL DEFAULT false;
