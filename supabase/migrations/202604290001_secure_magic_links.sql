-- Migration: Secure Magic Links
-- Description: Adds a table to track and invalidate magic links for enhanced security.

CREATE TABLE IF NOT EXISTS public.magic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by token hash
CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON public.magic_links(token_hash);

-- Index for invalidating previous links for an email
CREATE INDEX IF NOT EXISTS idx_magic_links_email_used ON public.magic_links(email, used);

-- Security: Enable RLS but don't allow public access. 
-- Only service role (server) should manage this table.
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;

-- No public policies means only service_role can access by default.
