-- ========================================================
-- MIGRATION: REMOVE LEGACY TABLES
-- ========================================================
-- This script safely removes the old inventory and billing 
-- tables that were replaced by the new V2 schema.
-- Cascade drops any foreign keys or constraints attached.

BEGIN;

DROP TABLE IF EXISTS public.bill_items CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.product_sales CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_products CASCADE;

COMMIT;
