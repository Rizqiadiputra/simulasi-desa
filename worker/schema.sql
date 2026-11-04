-- Jalankan sekali: lokal  -> psql -d desa_majapahit -f schema.sql
--                  Supabase -> tempel di SQL Editor dashboard Supabase
-- Aman dijalankan ulang (IF NOT EXISTS).

-- Simpanan desa: satu baris per pemain (player_id = UUID acak yang dibuat browser).
CREATE TABLE IF NOT EXISTS saves (
  player_id  UUID PRIMARY KEY,
  version    INTEGER NOT NULL,
  state      JSONB NOT NULL,
  saved_at   TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Penghitung pemakaian chat Claude per hari. key = 'global' atau 'ip:<alamat>'
CREATE TABLE IF NOT EXISTS chat_usage (
  day   DATE NOT NULL,
  key   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
