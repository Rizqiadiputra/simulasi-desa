-- Jalankan sekali: lokal  -> psql -d desa_majapahit -f schema.sql
--                  Supabase -> tempel di SQL Editor dashboard Supabase
-- Satu baris per pemain (player_id = UUID acak yang dibuat browser).
DROP TABLE IF EXISTS village_saves; -- versi lama (satu slot untuk semua)

CREATE TABLE IF NOT EXISTS saves (
  player_id  UUID PRIMARY KEY,
  version    INTEGER NOT NULL,
  state      JSONB NOT NULL,
  saved_at   TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
