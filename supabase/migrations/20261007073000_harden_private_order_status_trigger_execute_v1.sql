-- Harden private order-status trigger function execution.
-- The function is invoked by its trigger and is not an application RPC.
-- Keep it unreachable through direct client EXECUTE privileges.
revoke execute on function private.mnty_notify_order_status() from public, anon, authenticated;
