ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS location_resolved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS place_id text,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS supporting_notes text;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position;
