-- CRM enhancements: labels/tags, internal notes

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_tag') THEN
    CREATE TYPE client_tag AS ENUM ('Nuevo', 'Frecuente', 'VIP', 'Pendiente');
  END IF;
END$$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS tag client_tag,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

