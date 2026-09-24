-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Core tenancy: tenants, users, memberships, RBAC, theme settings, audit (ADR-0001/0002/0003).
-- Runs as ra_owner. Every table with tenant_id gets RLS (enabled + forced) and composite keys.

-- ADR-0001: the tenant context. NULL when unset, so policies fail closed.
CREATE FUNCTION ra_current_tenant() RETURNS uuid
	LANGUAGE sql STABLE PARALLEL SAFE
	AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

-- Global tables ------------------------------------------------------------------------------

CREATE TABLE tenants (
	id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	slug                    text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
	name                    text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	status                  text NOT NULL DEFAULT 'active'
	                        CHECK (status IN ('provisioning', 'active', 'suspended', 'pending_deletion')),
	default_locale          text NOT NULL DEFAULT 'nl' CHECK (default_locale IN ('nl', 'en')),
	currency                char(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
	fiscal_year_start_month smallint NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
	created_at              timestamptz NOT NULL DEFAULT now(),
	updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
	id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	email             text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+$'), -- pii: identity
	password_hash     text,
	preferred_locale  text CHECK (preferred_locale IN ('nl', 'en')),
	platform_role     text CHECK (platform_role IN ('super_admin', 'support')),
	last_tenant_id    uuid REFERENCES tenants (id) ON DELETE SET NULL,
	email_verified_at timestamptz,
	erased_at         timestamptz,
	created_at        timestamptz NOT NULL DEFAULT now(),
	updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- ADR-0003: mirrors the catalogue in src/lib/domain/permissions.ts (synced after migrations).
CREATE TABLE permissions (
	code         text PRIMARY KEY CHECK (code ~ '^[a-z_]+:[a-z_]+$'),
	group_key    text NOT NULL,
	is_dangerous boolean NOT NULL DEFAULT false
);

CREATE TABLE platform_audit_log (
	id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	actor_user_id  uuid REFERENCES users (id) ON DELETE SET NULL,
	action         text NOT NULL,
	subject_type   text NOT NULL,
	subject_id     uuid,
	changed_fields jsonb NOT NULL DEFAULT '{}', -- ADR-0005: field names only for PII columns
	request_id     text,
	at             timestamptz NOT NULL DEFAULT now()
);

-- Tenant tables ------------------------------------------------------------------------------

-- A person in a club. Most are references without an account (user_id NULL); only people who
-- manage inventory get one (ADR-0001).
CREATE TABLE tenant_memberships (
	tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id            uuid NOT NULL DEFAULT gen_random_uuid(),
	user_id       uuid REFERENCES users (id) ON DELETE SET NULL,
	display_name  text,          -- pii: identity
	email         text,          -- pii: contact
	phone         text,          -- pii: contact
	member_number text,          -- pii: identity
	notes         text,          -- pii: free_text
	status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'anonymized')),
	pseudonym_id  char(8) CHECK (pseudonym_id ~ '^[0-9a-f]{8}$'),
	anonymized_at timestamptz,
	created_at    timestamptz NOT NULL DEFAULT now(),
	updated_at    timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id),
	CHECK (status = 'anonymized' OR display_name IS NOT NULL),
	CHECK ((status = 'anonymized') = (anonymized_at IS NOT NULL AND pseudonym_id IS NOT NULL))
);
CREATE UNIQUE INDEX tenant_memberships_user_key
	ON tenant_memberships (tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX tenant_memberships_user_idx ON tenant_memberships (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE roles (
	tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id         uuid NOT NULL DEFAULT gen_random_uuid(),
	label_key  text,  -- system/template roles (ADR-0007)
	label_i18n jsonb, -- renamed/custom roles: {"nl": "...", "en": "..."}
	is_system  boolean NOT NULL DEFAULT false,
	version    integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id),
	CHECK (label_key IS NOT NULL OR label_i18n IS NOT NULL),
	CHECK (label_i18n IS NULL OR jsonb_typeof(label_i18n) = 'object')
);
-- Exactly one Tenant Admin system role per tenant.
CREATE UNIQUE INDEX roles_system_key ON roles (tenant_id) WHERE is_system;

CREATE TABLE role_permissions (
	tenant_id       uuid NOT NULL,
	role_id         uuid NOT NULL,
	permission_code text NOT NULL REFERENCES permissions (code) ON DELETE CASCADE,
	PRIMARY KEY (tenant_id, role_id, permission_code),
	FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE membership_roles (
	tenant_id     uuid NOT NULL,
	membership_id uuid NOT NULL,
	role_id       uuid NOT NULL,
	PRIMARY KEY (tenant_id, membership_id, role_id),
	FOREIGN KEY (tenant_id, membership_id) REFERENCES tenant_memberships (tenant_id, id) ON DELETE CASCADE,
	FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX membership_roles_role_idx ON membership_roles (tenant_id, role_id);

-- ADR-0002: typed values only, never raw CSS.
CREATE TABLE theme_settings (
	tenant_id       uuid PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
	color_primary   char(7) NOT NULL DEFAULT '#1f4e79' CHECK (color_primary ~ '^#[0-9a-fA-F]{6}$'),
	color_secondary char(7) NOT NULL DEFAULT '#c9a227' CHECK (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
	color_accent    char(7) CHECK (color_accent ~ '^#[0-9a-fA-F]{6}$'),
	radius          text NOT NULL DEFAULT 'md' CHECK (radius IN ('none', 'sm', 'md', 'lg')),
	font_family     text NOT NULL DEFAULT 'system' CHECK (font_family IN ('system', 'serif', 'rounded')),
	density         text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('compact', 'comfortable')),
	logo_object_key text,
	version         integer NOT NULL DEFAULT 1,
	updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
	tenant_id           uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id                  bigint GENERATED ALWAYS AS IDENTITY,
	actor_membership_id uuid,
	action              text NOT NULL,
	subject_type        text NOT NULL,
	subject_id          uuid,
	changed_fields      jsonb NOT NULL DEFAULT '{}', -- ADR-0005: field names only for PII columns
	request_id          text,
	at                  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id)
);
CREATE INDEX audit_log_at_idx ON audit_log (tenant_id, at DESC);

-- Row-level security -------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
	FOREACH t IN ARRAY ARRAY[
		'tenant_memberships', 'roles', 'role_permissions', 'membership_roles',
		'theme_settings', 'audit_log'
	] LOOP
		EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
		EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
		EXECUTE format(
			'CREATE POLICY tenant_isolation ON %I
			 USING (tenant_id = ra_current_tenant())
			 WITH CHECK (tenant_id = ra_current_tenant())', t);
	END LOOP;
END $$;

-- Cross-tenant lookup ------------------------------------------------------------------------

-- ADR-0001 §3: before a tenant context exists, the app must list the signed-in user's active
-- memberships (tenant switcher, slug → membership check). Runs as ra_owner (BYPASSRLS) and
-- returns only that user's own rows.
CREATE FUNCTION ra_user_memberships(p_user_id uuid)
	RETURNS TABLE (tenant_id uuid, tenant_slug text, tenant_name text, membership_id uuid)
	LANGUAGE sql STABLE SECURITY DEFINER
	SET search_path = public, pg_temp
	AS $$
		SELECT t.id, t.slug, t.name, m.id
		FROM tenant_memberships m
		JOIN tenants t ON t.id = m.tenant_id
		WHERE m.user_id = p_user_id AND m.status = 'active' AND t.status IN ('active', 'suspended')
		ORDER BY t.name
	$$;

-- Privileges for the application role ---------------------------------------------------------

REVOKE ALL ON FUNCTION ra_user_memberships(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ra_user_memberships(uuid) TO ra_app;

GRANT SELECT, INSERT, UPDATE ON tenants, users TO ra_app;
GRANT SELECT ON permissions TO ra_app;
GRANT SELECT, INSERT, UPDATE, DELETE
	ON tenant_memberships, roles, role_permissions, membership_roles, theme_settings TO ra_app;
-- Append-only (ADR-0005, ADR-0017).
GRANT SELECT, INSERT ON audit_log, platform_audit_log TO ra_app;
