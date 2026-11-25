ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT 'local';
ALTER TABLE users ALTER COLUMN object_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN object_id SET DEFAULT '';
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email SET DEFAULT '';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('dev','admin','user','member'));

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username)) WHERE username IS NOT NULL;
