-- ============================================================
-- MANTIQATIX ENTERPRISE PLATFORM
-- PHASE 06: FINANCIAL CORE HARDENING (POSTGRESQL / SUPABASE)
-- ============================================================

-- 01. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 02. CHART OF ACCOUNTS
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    account_code VARCHAR(32) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    normal_balance VARCHAR(16) NOT NULL DEFAULT 'DEBIT' CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tenant_account_code UNIQUE (tenant_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_tenant_type ON chart_of_accounts(tenant_id, account_type);

-- 03. JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    entry_number VARCHAR(64) NOT NULL,
    reference_type VARCHAR(64),
    reference_id VARCHAR(64),
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'CORRECTED')),
    total_debit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (total_debit >= 0),
    total_credit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (total_credit >= 0),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    posted_at TIMESTAMPTZ,
    reversed_by_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    correction_for_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_double_entry_balance CHECK (
        status != 'POSTED' OR (total_debit = total_credit AND total_debit > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_je_tenant_status ON journal_entries(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_je_ref ON journal_entries(reference_type, reference_id);

-- 04. JOURNAL ENTRY LINES
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id VARCHAR(64) PRIMARY KEY,
    journal_entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    line_number INT NOT NULL DEFAULT 1,
    debit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (debit >= 0),
    credit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (credit >= 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_debit_or_credit CHECK (
        (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

-- 05. GENERAL LEDGER
CREATE TABLE IF NOT EXISTS general_ledger (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT,
    journal_entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    journal_line_id VARCHAR(64) NOT NULL REFERENCES journal_entry_lines(id) ON DELETE RESTRICT,
    account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (debit >= 0),
    credit NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (credit >= 0),
    running_balance NUMERIC(14,4) NOT NULL DEFAULT 0.0,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gl_account_date ON general_ledger(account_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_gl_tenant_biz ON general_ledger(tenant_id, business_id);

-- 06. WALLET SYSTEM (ACCOUNTING-BACKED)
CREATE TABLE IF NOT EXISTS wallet_accounts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    owner_type VARCHAR(32) NOT NULL CHECK (owner_type IN ('CUSTOMER', 'MERCHANT', 'PARTNER', 'SYSTEM')),
    owner_id VARCHAR(64) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'EGP',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    allow_negative BOOLEAN NOT NULL DEFAULT false,
    gl_account_id VARCHAR(64) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_wallet_owner UNIQUE (tenant_id, owner_type, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_owner ON wallet_accounts(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    wallet_id VARCHAR(64) NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT', 'COMMISSION_SETTLEMENT')),
    amount NUMERIC(14,4) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(14,4) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'REVERSED', 'FAILED')),
    reference_type VARCHAR(64),
    reference_id VARCHAR(64),
    description TEXT,
    journal_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wt_wallet_created ON wallet_transactions(wallet_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wt_idempotency ON wallet_transactions(idempotency_key);

-- 07. COMMISSION SYSTEM PERSISTENCE
CREATE TABLE IF NOT EXISTS commission_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    module_id VARCHAR(64) REFERENCES modules(id) ON DELETE RESTRICT,
    rule_type VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE' CHECK (rule_type IN ('PERCENTAGE', 'FIXED_PER_ORDER', 'PRODUCT_MARKUP', 'FIXED_MONTHLY_SUBSCRIPTION')),
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
    order_amount NUMERIC(14,4) NOT NULL CHECK (order_amount >= 0),
    commission_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0 CHECK (commission_rate >= 0),
    commission_amount NUMERIC(14,4) NOT NULL CHECK (commission_amount >= 0),
    platform_net NUMERIC(14,4) NOT NULL CHECK (platform_net >= 0),
    merchant_net NUMERIC(14,4) NOT NULL CHECK (merchant_net >= 0),
    journal_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('CALCULATED', 'POSTED', 'SETTLED', 'REFUNDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_order_commission UNIQUE (tenant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_biz_order ON commission_transactions(business_id, order_id);

-- 08. SETTLEMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS settlement_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    beneficiary_type VARCHAR(32) NOT NULL CHECK (beneficiary_type IN ('MERCHANT', 'PARTNER', 'CAPTAIN')),
    beneficiary_id VARCHAR(64) NOT NULL,
    gross_amount NUMERIC(14,4) NOT NULL CHECK (gross_amount >= 0),
    platform_fee NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (platform_fee >= 0),
    net_payout NUMERIC(14,4) NOT NULL CHECK (net_payout >= 0),
    voucher_reserve NUMERIC(14,4) NOT NULL DEFAULT 0.0 CHECK (voucher_reserve >= 0),
    payout_channel VARCHAR(64) NOT NULL DEFAULT 'BANK_TRANSFER',
    journal_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'CANCELLED')),
    reference_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stl_beneficiary ON settlement_transactions(beneficiary_type, beneficiary_id);

-- 09. PAYMENT EVENTS (IDEMPOTENCY & DUPLICATE PROTECTION)
CREATE TABLE IF NOT EXISTS payment_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    event_id VARCHAR(128) UNIQUE NOT NULL,
    payment_id VARCHAR(64) NOT NULL,
    amount NUMERIC(14,4) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'FAILED', 'REFUNDED')),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pe_event_id ON payment_events(event_id);

CREATE INDEX IF NOT EXISTS idx_pe_payment ON payment_events(payment_id);

-- ============================================================
-- 10. POSTGRESQL TRIGGERS & BUSINESS INTEGRITY FUNCTIONS
-- ============================================================

-- A. IMMUTABILITY TRIGGER: PREVENT DIRECT MODIFICATION OR DELETION OF POSTED JOURNAL ENTRIES
CREATE OR REPLACE FUNCTION trg_enforce_journal_entry_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- If already POSTED, block direct deletion
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'POSTED' THEN
            RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Posted journal entry % cannot be deleted. Use reversal or correction entry.', OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    -- If already POSTED, check allowed updates
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'POSTED' THEN
            -- Only allow transitioning to REVERSED or CORRECTED with reversal pointer
            IF NEW.status IN ('REVERSED', 'CORRECTED') THEN
                IF NEW.total_debit != OLD.total_debit OR NEW.total_credit != OLD.total_credit THEN
                    RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Total amounts of posted journal entry % cannot be altered.', OLD.id;
                END IF;
                IF NEW.reversed_by_entry_id IS NULL AND NEW.correction_for_entry_id IS NULL THEN
                    RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Status reversal requires pointer to reversal or correction entry.';
                END IF;
                RETURN NEW;
            ELSE
                RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE: Posted journal entry % cannot be modified directly. Use reversal or correction entry.', OLD.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_immutability ON journal_entries;

CREATE TRIGGER trg_journal_entry_immutability
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION trg_enforce_journal_entry_immutability();

-- B. IMMUTABILITY TRIGGER ON JOURNAL ENTRY LINES: PREVENT EDITING LINES OF POSTED ENTRIES
CREATE OR REPLACE FUNCTION trg_enforce_journal_line_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_entry_status VARCHAR(32);
    v_target_id VARCHAR(64);
BEGIN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;
    
    SELECT status INTO v_entry_status
    FROM journal_entries
    WHERE id = v_target_id;

    IF v_entry_status = 'POSTED' THEN
        RAISE EXCEPTION 'JOURNAL_LINE_IMMUTABLE: Lines of posted journal entry % cannot be inserted, modified, or deleted.', v_target_id;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_line_immutability ON journal_entry_lines;

CREATE TRIGGER trg_journal_line_immutability
BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION trg_enforce_journal_line_immutability();

-- C. DOUBLE ENTRY VALIDATION TRIGGER: SUM(DEBIT) == SUM(CREDIT)
CREATE OR REPLACE FUNCTION trg_validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_sum_debit NUMERIC(14,4);
    v_sum_credit NUMERIC(14,4);
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
        INTO v_sum_debit, v_sum_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        IF ABS(v_sum_debit - v_sum_credit) > 0.0001 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_IMBALANCE: Journal Entry % is unbalanced. Total Debit (%) != Total Credit (%).', NEW.id, v_sum_debit, v_sum_credit;
        END IF;

        IF v_sum_debit <= 0 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_INVALID: Journal Entry % must have positive debit/credit lines.', NEW.id;
        END IF;

        -- Ensure header matches lines
        NEW.total_debit := v_sum_debit;
        NEW.total_credit := v_sum_credit;
        NEW.posted_at := COALESCE(NEW.posted_at, CURRENT_TIMESTAMP);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_balance ON journal_entries;

CREATE TRIGGER trg_validate_journal_balance
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION trg_validate_journal_entry_balance();

-- D. AUTOMATIC GENERAL LEDGER POSTING TRIGGER ON POSTED JOURNAL ENTRIES
CREATE OR REPLACE FUNCTION trg_post_journal_to_general_ledger()
RETURNS TRIGGER AS $$
DECLARE
    r_line RECORD;
    v_running NUMERIC(14,4);
BEGIN
    IF NEW.status = 'POSTED' AND (OLD IS NULL OR OLD.status != 'POSTED') THEN
        FOR r_line IN (SELECT * FROM journal_entry_lines WHERE journal_entry_id = NEW.id ORDER BY line_number ASC) LOOP
            
            -- Calculate latest running balance for the account
            SELECT COALESCE(running_balance, 0) INTO v_running
            FROM general_ledger
            WHERE account_id = r_line.account_id
            ORDER BY posted_at DESC, id DESC
            LIMIT 1;

            v_running := COALESCE(v_running, 0) + (r_line.debit - r_line.credit);

            INSERT INTO general_ledger (
                id,
                tenant_id,
                business_id,
                journal_entry_id,
                journal_line_id,
                account_id,
                debit,
                credit,
                running_balance,
                entry_date,
                posted_at
            ) VALUES (
                'gl_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16),
                NEW.tenant_id,
                NEW.business_id,
                NEW.id,
                r_line.id,
                r_line.account_id,
                r_line.debit,
                r_line.credit,
                v_running,
                NEW.entry_date,
                NEW.posted_at
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_journal_to_gl ON journal_entries;

CREATE TRIGGER trg_post_journal_to_gl
AFTER INSERT OR UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION trg_post_journal_to_general_ledger();

-- E. WALLET NON-NEGATIVE BALANCE VALIDATION TRIGGER
CREATE OR REPLACE FUNCTION trg_enforce_wallet_balance_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_allow_negative BOOLEAN;
    v_current_balance NUMERIC(14,4);
    v_new_balance NUMERIC(14,4);
BEGIN
    SELECT allow_negative INTO v_allow_negative
    FROM wallet_accounts
    WHERE id = NEW.wallet_id;

    -- Calculate projected balance from all confirmed transactions
    SELECT COALESCE(SUM(CASE 
        WHEN transaction_type IN ('CREDIT', 'REFUND') THEN amount 
        WHEN transaction_type IN ('DEBIT', 'COMMISSION_SETTLEMENT') THEN -amount 
        ELSE 0 END), 0)
    INTO v_current_balance
    FROM wallet_transactions
    WHERE wallet_id = NEW.wallet_id AND status = 'CONFIRMED' AND id != NEW.id;

    IF NEW.transaction_type IN ('CREDIT', 'REFUND') THEN
        v_new_balance := v_current_balance + NEW.amount;
    ELSE
        v_new_balance := v_current_balance - NEW.amount;
    END IF;

    IF v_new_balance < 0 AND NOT COALESCE(v_allow_negative, false) THEN
        RAISE EXCEPTION 'NEGATIVE_BALANCE_FORBIDDEN: Wallet % balance would drop to %, negative balance not allowed.', NEW.wallet_id, v_new_balance;
    END IF;

    NEW.balance_after := v_new_balance;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_balance_integrity ON wallet_transactions;

CREATE TRIGGER trg_wallet_balance_integrity
BEFORE INSERT ON wallet_transactions
FOR EACH ROW EXECUTE FUNCTION trg_enforce_wallet_balance_integrity();

-- ============================================================
-- 11. POSTGRESQL STORED PROCEDURES / FUNCTIONS FOR ATOMIC OPERATIONS
-- ============================================================

-- Function: Atomic Journal Entry Reversal
CREATE OR REPLACE FUNCTION reverse_journal_entry(
    p_original_entry_id VARCHAR,
    p_reason TEXT,
    p_reversed_by VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_original journal_entries%ROWTYPE;
    v_reversal_id VARCHAR;
    v_line journal_entry_lines%ROWTYPE;
    v_line_counter INT := 1;
BEGIN
    SELECT * INTO v_original FROM journal_entries WHERE id = p_original_entry_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ENTRY_NOT_FOUND: Journal entry % does not exist.', p_original_entry_id;
    END IF;

    IF v_original.status != 'POSTED' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Only POSTED journal entries can be reversed. Current status: %', v_original.status;
    END IF;

    v_reversal_id := 'je_rev_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16);

    -- Insert Draft Reversal Entry
    INSERT INTO journal_entries (
        id, tenant_id, organization_id, business_id, branch_id,
        entry_number, reference_type, reference_id, description,
        status, total_debit, total_credit, entry_date, created_by
    ) VALUES (
        v_reversal_id, v_original.tenant_id, v_original.organization_id, v_original.business_id, v_original.branch_id,
        'REV-' || v_original.entry_number, 'REVERSAL', v_original.id,
        'قيد عكسي للقيد رقم ' || v_original.entry_number || ': ' || p_reason,
        'DRAFT', v_original.total_credit, v_original.total_debit, CURRENT_DATE, p_reversed_by
    );

    -- Invert Lines (Debit becomes Credit, Credit becomes Debit)
    FOR v_line IN (SELECT * FROM journal_entry_lines WHERE journal_entry_id = p_original_entry_id) LOOP
        INSERT INTO journal_entry_lines (
            id, journal_entry_id, account_id, line_number, debit, credit, description
        ) VALUES (
            'jel_rev_' || SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', ''), 1, 16),
            v_reversal_id,
            v_line.account_id,
            v_line_counter,
            v_line.credit, -- swapped
            v_line.debit,  -- swapped
            'عكس بند: ' || COALESCE(v_line.description, '')
        );
        v_line_counter := v_line_counter + 1;
    END LOOP;

    -- Post the reversal entry
    UPDATE journal_entries 
    SET status = 'POSTED', posted_at = CURRENT_TIMESTAMP 
    WHERE id = v_reversal_id;

    -- Update original entry status to REVERSED pointing to reversal
    UPDATE journal_entries
    SET status = 'REVERSED', reversed_by_entry_id = v_reversal_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = p_original_entry_id;

    RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql;
