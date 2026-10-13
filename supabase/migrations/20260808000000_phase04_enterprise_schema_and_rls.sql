-- ============================================================
-- MANTIQATIX ENTERPRISE PLATFORM
-- PHASE 04: ENTERPRISE DATABASE SCHEMA, MULTI-TENANCY & SUPABASE RLS
-- ============================================================

-- 01. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 02. CORE TENANCY & ORGANIZATIONAL HIERARCHY TABLES
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_org_tenant_code UNIQUE (tenant_id, code)
);

-- Existing remote public.businesses is EMPTY and already has id UUID and base marketplace columns.
-- Extend it non-destructively instead of recreating it.
DO $$
BEGIN
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64);
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type VARCHAR(64) DEFAULT 'RESTAURANT';
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PENDING_APPROVAL';
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_tenant_id_fkey') THEN
        ALTER TABLE businesses ADD CONSTRAINT businesses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_organization_id_fkey') THEN
        ALTER TABLE businesses ADD CONSTRAINT businesses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    phone VARCHAR(32),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_branch_biz_code UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 03. IDENTITY & USERS MAPPED TO PUBLIC.USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Linked to auth.users.id
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    email VARCHAR(255),
    role VARCHAR(64) NOT NULL DEFAULT 'CUSTOMER',
    roles JSONB NOT NULL DEFAULT '["CUSTOMER"]'::jsonb,
    active_workspace_role VARCHAR(64) NOT NULL DEFAULT 'CUSTOMER',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    custom_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_region JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_memberships (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE CASCADE,
    role VARCHAR(64) NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_biz_branch UNIQUE (user_id, business_id, branch_id)
);

-- 04. MASTER DATA & SECTOR CATALOG
CREATE TABLE IF NOT EXISTS business_sectors (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS business_categories (
    id VARCHAR(64) PRIMARY KEY,
    sector_id VARCHAR(64) NOT NULL REFERENCES business_sectors(id) ON DELETE RESTRICT,
    code VARCHAR(64) UNIQUE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 05. MODULE CONFIGURATION PERSISTENCE
CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    configuration JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_modules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id VARCHAR(64) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB DEFAULT '{}'::jsonb,
    enabled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    disabled_at TIMESTAMPTZ,
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tenant_module UNIQUE (tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS business_modules (
    id VARCHAR(64) PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    module_id VARCHAR(64) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_business_module UNIQUE (business_id, module_id)
);

-- 06. PRODUCTS & INVENTORY
-- Existing remote public.products is EMPTY and already has id UUID and base marketplace columns.
-- Extend it non-destructively instead of recreating it.
DO $$
BEGIN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id VARCHAR(64);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id VARCHAR(64);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(128);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(128);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(64) DEFAULT 'STANDARD';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(32) DEFAULT 'PCS';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) DEFAULT 0.0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_id_fkey') THEN
        ALTER TABLE products ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_organization_id_fkey') THEN
        ALTER TABLE products ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_branch_id_fkey') THEN
        ALTER TABLE products ADD CONSTRAINT products_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
        ALTER TABLE products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES business_categories(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id VARCHAR(64) REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(64) NOT NULL, -- IN, OUT, ADJUSTMENT, TRANSFER
    quantity NUMERIC(14,4) NOT NULL,
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0.0,
    reference_id VARCHAR(128),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_balances (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(14,4) NOT NULL DEFAULT 0.0,
    quantity_reserved NUMERIC(14,4) NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_wh_product UNIQUE (warehouse_id, product_id)
);

-- 07. ORDERS & WORKFLOW
-- Existing remote public.orders is EMPTY and already has id UUID and base marketplace columns.
-- Extend it non-destructively instead of recreating it.
DO $$
BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id VARCHAR(64);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_partner_id UUID;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(14,4) DEFAULT 0.0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'SAR';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_tenant_id_fkey') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_organization_id_fkey') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_branch_id_fkey') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fkey') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_assigned_partner_id_fkey') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_assigned_partner_id_fkey FOREIGN KEY (assigned_partner_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 1.0 CHECK (quantity > 0),
    unit_price NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (unit_price >= 0),
    discount NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (discount >= 0),
    tax NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (tax >= 0),
    total NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (total >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(64),
    new_status VARCHAR(64) NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 08. APPROVAL & WORKFLOW ENGINE PERSISTENCE
CREATE TABLE IF NOT EXISTS approval_requests (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE CASCADE,
    request_type VARCHAR(64) NOT NULL, -- BUSINESS_REGISTRATION, CAMPAIGN, PAYOUT, DISCOUNT
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_actions (
    id VARCHAR(64) PRIMARY KEY,
    approval_request_id VARCHAR(64) NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL, -- APPROVED, REJECTED, CANCELLED
    acted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 09. DOUBLE ENTRY FINANCIAL LEDGER
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    account_code VARCHAR(32) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tenant_account_code UNIQUE (tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    reference_type VARCHAR(64),
    reference_id VARCHAR(64),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'POSTED',
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id VARCHAR(64) PRIMARY KEY,
    journal_entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (debit >= 0),
    credit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (credit >= 0),
    description TEXT
);

-- FUNCTION TO VALIDATE DOUBLE ENTRY BALANCE
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_debit NUMERIC(14,4);
    v_credit NUMERIC(14,4);
BEGIN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_debit, v_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF ABS(v_debit - v_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Financial Ledger Error: Unbalanced Journal Entry. Total Debit (%) must equal Total Credit (%)', v_debit, v_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. COMMISSION ENGINE PERSISTENCE
CREATE TABLE IF NOT EXISTS commission_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    module_id VARCHAR(64) REFERENCES modules(id) ON DELETE RESTRICT,
    rule_type VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE',
    percentage NUMERIC(6,4) DEFAULT 0.0 CHECK (percentage >= 0),
    fixed_amount NUMERIC(14,4) DEFAULT 0.0 CHECK (fixed_amount >= 0),
    per_item_amount NUMERIC(14,4) DEFAULT 0.0 CHECK (per_item_amount >= 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    rule_id VARCHAR(64) REFERENCES commission_rules(id) ON DELETE SET NULL,
    gross_amount NUMERIC(14,4) NOT NULL CHECK (gross_amount >= 0),
    commission_amount NUMERIC(14,4) NOT NULL CHECK (commission_amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. ADVERTISING & CAMPAIGNS
CREATE TABLE IF NOT EXISTS ad_spaces (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    placement VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS advertisements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ad_space_id VARCHAR(64) NOT NULL REFERENCES ad_spaces(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    creative_url TEXT NOT NULL,
    target_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
    approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. AUDIT LOGGING (APPEND ONLY)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    actor_user_id UUID NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    result VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. NOTIFICATIONS PERSISTENCE
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_biz ON public.users(business_id);

CREATE INDEX IF NOT EXISTS idx_businesses_tenant ON businesses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_businesses_org ON businesses(organization_id);

CREATE INDEX IF NOT EXISTS idx_branches_biz ON branches(business_id);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_biz ON orders(tenant_id, business_id);

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_products_biz_sku ON products(business_id, sku);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);

-- 15. RLS HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
    SELECT auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS VARCHAR AS $$
    SELECT tenant_id FROM public.users WHERE id = current_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION current_business_id()
RETURNS UUID AS $$
    SELECT business_id FROM public.users WHERE id = current_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 16. SUPABASE RLS POLICIES (TENANT ISOLATION & RBAC)

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- BUSINESSES POLICIES
CREATE POLICY p_select_businesses ON businesses
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        OR status = 'ACTIVE' -- Public customer discovery
    );

CREATE POLICY p_insert_businesses ON businesses
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
    );

CREATE POLICY p_update_businesses ON businesses
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND (owner_id = current_user_id() OR id = current_business_id())
    );

-- ORDERS POLICIES
CREATE POLICY p_select_orders ON orders
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        AND (customer_id = current_user_id() OR business_id = current_business_id() OR assigned_partner_id = current_user_id())
    );

CREATE POLICY p_insert_orders ON orders
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
    );

CREATE POLICY p_update_orders ON orders
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND (business_id = current_business_id() OR assigned_partner_id = current_user_id())
    );

-- AUDIT LOGS POLICIES (APPEND ONLY READ-OWN-TENANT)
CREATE POLICY p_select_audit_logs ON audit_logs
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY p_insert_audit_logs ON audit_logs
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
    );

-- NOTIFICATIONS POLICIES
CREATE POLICY p_select_notifications ON notifications
    FOR SELECT USING (
        user_id = current_user_id()
    );
