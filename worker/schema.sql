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

-- Simpanan manual: maksimal 5 slot per pemain. summary = ringkasan untuk daftar (hari, warga, kas, ...)
CREATE TABLE IF NOT EXISTS save_slots (
  player_id UUID NOT NULL,
  slot      SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 5),
  name      TEXT NOT NULL,
  summary   JSONB NOT NULL DEFAULT '{}',
  version   INTEGER NOT NULL,
  state     JSONB NOT NULL,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, slot)
);

-- Penghitung pemakaian chat Claude per hari. key = 'global' atau 'ip:<alamat>'
CREATE TABLE IF NOT EXISTS chat_usage (
  day   DATE NOT NULL,
  key   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
