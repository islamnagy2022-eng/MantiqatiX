-- ============================================================
-- MANTIQATIX ENTERPRISE PLATFORM
-- PHASE 05: REAL-TIME SYNC, CONFLICT RESOLUTION & OFFLINE ENGINE
-- ============================================================

-- 01. REAL-TIME SYNC LOGS TABLE (OPTIONAL AUDIT FOR SYNC ENGINE)
CREATE TABLE IF NOT EXISTS sync_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    user_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    operation VARCHAR(32) NOT NULL, -- CREATE, UPDATE, DELETE
    sync_status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    conflict_resolved BOOLEAN DEFAULT false,
    resolution_strategy VARCHAR(64),
    client_timestamp TIMESTAMPTZ,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_select_sync_logs ON sync_logs
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY p_insert_sync_logs ON sync_logs
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
    );

-- 02. ENABLE REALTIME PUBLICATION FOR ORDERS & NOTIFICATIONS & APPROVALS
-- Note: Supabase Realtime requires publication inclusion for live streaming
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
        ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
