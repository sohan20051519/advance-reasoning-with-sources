-- Run this in your Supabase SQL Editor

create table public.research_logs (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  content jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Optional: Enable Vector extension if you plan to use embeddings later
-- create extension if not exists vector;
