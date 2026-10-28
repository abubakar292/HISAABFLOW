import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ooneazyrjvxqztqmlpad.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbmVhenlyanZ4cXp0cW1scGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY5ODMsImV4cCI6MjEwODc0Mjk4M30.3b9lveNatqIqF-iECbLOqBDSAEL-IhJCI5k1RNam6ww';

export const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbmVhenlyanZ4cXp0cW1scGFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzE2Njk4MywiZXhwIjoyMTA4NzQyOTgzfQ.Qmg0URjSDqi6a6T7bqhI5L1B9hrC3JEmkizvFIVeOCA';

export const SUPABASE_BUCKET = 'shop-assets';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'hf-supabase-user-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const adminMemoryStorage: Record<string, string> = {};

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    storageKey: 'hf-supabase-admin-service-role',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: (key: string) => adminMemoryStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        adminMemoryStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete adminMemoryStorage[key];
      },
    },
  },
});

/**
 * Optional SQL script for creating native PostgreSQL tables in the Supabase Table Editor.
 * The app works immediately via Supabase Auth + Supabase Storage (`shop-assets`), and once
 * these tables are created in SQL Editor, it also writes every row into PostgreSQL tables.
 */
export const SUPABASE_SQL_SCHEMA = `-- Run this once in your Supabase Dashboard -> SQL Editor
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shops (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mobiles (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bills (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.khata (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."khataTransactions" (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backups (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  user_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`;
