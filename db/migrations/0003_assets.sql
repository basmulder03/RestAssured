-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Assets and who/where they are (docs/SYSTEM_SPEC.md §2). Tenant tables: RLS enabled + forced,
-- composite keys, composite foreign keys (ADR-0001).

CREATE TABLE asset_categories (
	tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id              uuid NOT NULL DEFAULT gen_random_uuid(),
	kind            text NOT NULL CHECK (kind IN ('instrument', 'clothing', 'accessory', 'case')),
	label_key       text,  -- default categories (ADR-0007)
	label_i18n      jsonb, -- club-defined or renamed: {"nl": "...", "en": "..."}
	-- ADR-0006 per-club overrides of the platform forecasting defaults; NULL = use default.
	lifespan_years  smallint CHECK (lifespan_years BETWEEN 1 AND 100),
	residual_pct    numeric(5, 2) CHECK (residual_pct BETWEEN 0 AND 100),
	maintenance_pct numeric(5, 2) CHECK (maintenance_pct BETWEEN 0 AND 100),
	sort_order      integer NOT NULL DEFAULT 0,
	archived_at     timestamptz,
	created_at      timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id),
	CHECK (label_key IS NOT NULL OR label_i18n IS NOT NULL),
	CHECK (label_i18n IS NULL OR jsonb_typeof(label_i18n) = 'object')
);

-- Storage places ("Waar"): the rehearsal room, the depot, a board member's garage. Proper names,
-- entered in one language, so a plain name rather than label_i18n.
CREATE TABLE locations (
	tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id          uuid NOT NULL DEFAULT gen_random_uuid(),
	name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	archived_at timestamptz,
	created_at  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX locations_name_key ON locations (tenant_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE assets (
	tenant_id            uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id                   uuid NOT NULL DEFAULT gen_random_uuid(),
	category_id          uuid NOT NULL,
	tag                  text CHECK (length(tag) <= 50),          -- club inventory number
	brand                text CHECK (length(brand) <= 100),       -- "Merk"
	model                text CHECK (length(model) <= 100),
	serial_number        text CHECK (length(serial_number) <= 100), -- "Serienr"
	description          text CHECK (length(description) <= 2000), -- pii: free_text
	purchase_price_cents bigint CHECK (purchase_price_cents >= 0),
	purchase_year        smallint CHECK (purchase_year BETWEEN 1900 AND 2200),
	insured_value_cents  bigint CHECK (insured_value_cents >= 0),
	insured_value_year   smallint CHECK (insured_value_year BETWEEN 1900 AND 2200),
	ownership            text NOT NULL DEFAULT 'club' CHECK (ownership IN ('club', 'private')),
	owner_membership_id  uuid,
	status               text NOT NULL DEFAULT 'active'
	                     CHECK (status IN ('active', 'in_repair', 'retired', 'lost', 'sold')),
	lifespan_years       smallint CHECK (lifespan_years BETWEEN 1 AND 100),
	created_at           timestamptz NOT NULL DEFAULT now(),
	updated_at           timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (tenant_id, id),
	FOREIGN KEY (tenant_id, category_id) REFERENCES asset_categories (tenant_id, id),
	FOREIGN KEY (tenant_id, owner_membership_id) REFERENCES tenant_memberships (tenant_id, id),
	CHECK ((ownership = 'private') = (owner_membership_id IS NOT NULL))
);
CREATE UNIQUE INDEX assets_tag_key ON assets (tenant_id, lower(tag)) WHERE tag IS NOT NULL;
-- The same serial from the same brand is the same instrument.
CREATE UNIQUE INDEX assets_serial_key
	ON assets (tenant_id, lower(coalesce(brand, '')), lower(serial_number)) WHERE serial_number IS NOT NULL;
CREATE INDEX assets_category_idx ON assets (tenant_id, category_id);

-- Who (a member) or where (a location) an asset is. Open while returned_at IS NULL; closed
-- assignments are the asset's history and survive anonymization (ADR-0005).
CREATE TABLE assignments (
	tenant_id               uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
	id                      uuid NOT NULL DEFAULT gen_random_uuid(),
	asset_id                uuid NOT NULL,
	membership_id           uuid,
	location_id             uuid,
	checked_out_at          timestamptz NOT NULL DEFAULT now(),
	returned_at             timestamptz,
	condition_out           text CHECK (length(condition_out) <= 500), -- pii: free_text
	condition_in            text CHECK (length(condition_in) <= 500),  -- pii: free_text
	notes                   text CHECK (length(notes) <= 2000),        -- pii: free_text
	issued_by_membership_id uuid,
	returned_by_membership_id uuid,
	PRIMARY KEY (tenant_id, id),
	FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE,
	FOREIGN KEY (tenant_id, membership_id) REFERENCES tenant_memberships (tenant_id, id),
	FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id),
	FOREIGN KEY (tenant_id, issued_by_membership_id) REFERENCES tenant_memberships (tenant_id, id),
	FOREIGN KEY (tenant_id, returned_by_membership_id) REFERENCES tenant_memberships (tenant_id, id),
	CHECK ((membership_id IS NULL) <> (location_id IS NULL)),
	CHECK (returned_at IS NULL OR returned_at >= checked_out_at)
);
CREATE UNIQUE INDEX assignments_open_key ON assignments (tenant_id, asset_id) WHERE returned_at IS NULL;
CREATE INDEX assignments_asset_idx ON assignments (tenant_id, asset_id, checked_out_at DESC);
CREATE INDEX assignments_member_idx ON assignments (tenant_id, membership_id) WHERE membership_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
	FOREACH t IN ARRAY ARRAY['asset_categories', 'locations', 'assets', 'assignments'] LOOP
		EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
		EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
		EXECUTE format(
			'CREATE POLICY tenant_isolation ON %I
			 USING (tenant_id = ra_current_tenant())
			 WITH CHECK (tenant_id = ra_current_tenant())', t);
	END LOOP;
END $$;

-- Default categories for the current tenant context. SECURITY INVOKER: runs under the caller's
-- RLS, so it can only ever write into the club whose context is set.
CREATE FUNCTION ra_seed_default_categories() RETURNS void
	LANGUAGE sql VOLATILE
	AS $$
		INSERT INTO asset_categories (tenant_id, kind, label_key, sort_order)
		SELECT ra_current_tenant(), kind, label_key, sort_order
		FROM (VALUES
			('instrument', 'categories.brass', 10),
			('instrument', 'categories.woodwind', 20),
			('instrument', 'categories.saxophones', 30),
			('instrument', 'categories.percussion', 40),
			('instrument', 'categories.other_instruments', 50),
			('clothing', 'categories.uniforms', 60),
			('clothing', 'categories.uniform_accessories', 70),
			('accessory', 'categories.music_stands', 80),
			('accessory', 'categories.accessories', 90),
			('case', 'categories.cases', 100)
		) AS d (kind, label_key, sort_order)
	$$;

-- Existing clubs get the defaults too.
DO $$
DECLARE t uuid;
BEGIN
	FOR t IN SELECT id FROM tenants LOOP
		PERFORM set_config('app.tenant_id', t::text, true);
		PERFORM ra_seed_default_categories();
	END LOOP;
	PERFORM set_config('app.tenant_id', '', true);
END $$;

REVOKE ALL ON FUNCTION ra_seed_default_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ra_seed_default_categories() TO ra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_categories, locations, assets, assignments TO ra_app;
