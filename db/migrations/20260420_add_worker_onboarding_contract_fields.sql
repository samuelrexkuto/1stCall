ALTER TABLE staff_subs
ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'not_sent',
ADD COLUMN IF NOT EXISTS contract_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS contract_document_url text,
ADD COLUMN IF NOT EXISTS id_document_uploaded boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cscs_uploaded boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS certificates_uploaded boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS portfolio_uploaded boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_source text NOT NULL DEFAULT 'internal';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workers'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE workers
      ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending_review',
      ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'not_sent',
      ADD COLUMN IF NOT EXISTS contract_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz,
      ADD COLUMN IF NOT EXISTS contract_document_url text,
      ADD COLUMN IF NOT EXISTS id_document_uploaded boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS cscs_uploaded boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS certificates_uploaded boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS portfolio_uploaded boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS onboarding_source text NOT NULL DEFAULT 'internal'
    $sql$;
  END IF;
END $$;
