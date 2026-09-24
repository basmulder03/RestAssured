-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Authentication (ADR-0004): sessions, one-time link tokens, rate limiting.
-- Tokens and session ids are stored only as SHA-256 hashes.

-- ADR-0004 §4: a password set from a club-scoped session (e.g. via an admin-issued reset link)
-- carries that scope, so password logins can't bypass the cross-tenant guard. Cleared when the
-- password is set again from an unscoped session.
ALTER TABLE users ADD COLUMN credential_scope_tenant_id uuid REFERENCES tenants (id) ON DELETE SET NULL;

CREATE TABLE sessions (
	token_hash       bytea PRIMARY KEY CHECK (length(token_hash) = 32),
	user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	-- ADR-0004 §4: set when the session came from a link issued by an admin of one club for a
	-- user who is also a member elsewhere. The session then only reaches that club.
	scoped_tenant_id uuid REFERENCES tenants (id) ON DELETE CASCADE,
	created_at       timestamptz NOT NULL DEFAULT now(),
	last_seen_at     timestamptz NOT NULL DEFAULT now(),
	expires_at       timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE auth_tokens (
	token_hash          bytea PRIMARY KEY CHECK (length(token_hash) = 32),
	purpose             text NOT NULL CHECK (purpose IN ('magic_login', 'invite', 'password_reset')),
	user_id             uuid REFERENCES users (id) ON DELETE CASCADE,
	-- Invites target a membership (the person may not have an account yet).
	target_tenant_id    uuid,
	membership_id       uuid,
	issued_by           uuid REFERENCES users (id) ON DELETE SET NULL,
	issued_in_tenant_id uuid REFERENCES tenants (id) ON DELETE CASCADE,
	created_at          timestamptz NOT NULL DEFAULT now(),
	expires_at          timestamptz NOT NULL,
	consumed_at         timestamptz,
	FOREIGN KEY (target_tenant_id, membership_id)
		REFERENCES tenant_memberships (tenant_id, id) ON DELETE CASCADE,
	CHECK ((target_tenant_id IS NULL) = (membership_id IS NULL)),
	CHECK (purpose <> 'invite' OR membership_id IS NOT NULL),
	CHECK (purpose = 'invite' OR user_id IS NOT NULL)
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id) WHERE consumed_at IS NULL;
CREATE INDEX auth_tokens_expires_idx ON auth_tokens (expires_at);

-- Keys are hashed by the application (they are derived from emails and IP addresses).
CREATE UNLOGGED TABLE rate_limits (
	key          text PRIMARY KEY,
	window_start timestamptz NOT NULL,
	hits         integer NOT NULL
);

-- Fixed-window counter. Returns true while the caller is within the limit.
CREATE FUNCTION ra_rate_limit_hit(p_key text, p_limit integer, p_window interval) RETURNS boolean
	LANGUAGE sql VOLATILE
	AS $$
		INSERT INTO rate_limits AS r (key, window_start, hits) VALUES (p_key, now(), 1)
		ON CONFLICT (key) DO UPDATE SET
			window_start = CASE WHEN r.window_start < now() - p_window THEN now() ELSE r.window_start END,
			hits = CASE WHEN r.window_start < now() - p_window THEN 1 ELSE r.hits + 1 END
		RETURNING hits <= p_limit
	$$;

-- ADR-0004 §4 cross-tenant guard: the clubs where a user is Tenant Admin. Same shape and
-- restrictions as ra_user_memberships (ADR-0001).
CREATE FUNCTION ra_user_admin_tenants(p_user_id uuid) RETURNS SETOF uuid
	LANGUAGE sql STABLE SECURITY DEFINER
	SET search_path = public, pg_temp
	AS $$
		SELECT m.tenant_id
		FROM tenant_memberships m
		JOIN membership_roles mr ON mr.tenant_id = m.tenant_id AND mr.membership_id = m.id
		JOIN roles r ON r.tenant_id = mr.tenant_id AND r.id = mr.role_id
		WHERE m.user_id = p_user_id AND m.status = 'active' AND r.is_system
	$$;

REVOKE ALL ON FUNCTION ra_user_admin_tenants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ra_user_admin_tenants(uuid) TO ra_app;
REVOKE ALL ON FUNCTION ra_rate_limit_hit(text, integer, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ra_rate_limit_hit(text, integer, interval) TO ra_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, auth_tokens, rate_limits TO ra_app;
