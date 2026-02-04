-- C21 Wave 3 PR1 Fix: Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
