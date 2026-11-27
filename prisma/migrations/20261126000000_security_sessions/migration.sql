CREATE TABLE browser_session (
 id TEXT PRIMARY KEY, family TEXT NOT NULL, subject TEXT NOT NULL,
 refresh_hash TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, payload JSONB NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX browser_session_family_idx ON browser_session(family);
CREATE INDEX browser_session_subject_idx ON browser_session(subject);
CREATE INDEX browser_session_expiry_idx ON browser_session(expires_at);
