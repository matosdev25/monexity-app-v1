-- Monexity: numeración independiente por empresa para ventas, cotizaciones y gastos.
-- Ejecutar en Supabase SQL Editor.
-- No borra historial ni toca billing, pagos, trial, membresías o permisos.

BEGIN;

-- Gastos no tenía columna de numeración en el esquema real.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_number text;

-- Quitar uniques globales de una sola columna para los campos de documento.
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'u'
      AND (
        (rel.relname = 'sales' AND con.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'invoice_number')
        ]::smallint[])
        OR
        (rel.relname = 'quotations' AND con.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'quotation_number')
        ]::smallint[])
        OR
        (rel.relname = 'expenses' AND con.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'expense_number')
        ]::smallint[])
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      constraint_row.relname,
      constraint_row.conname
    );
  END LOOP;
END $$;

-- Nombres conocidos/esperados, por seguridad si existen.
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_invoice_number_key;

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_quotation_number_key;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_expense_number_key;

-- Unicidad por empresa. Permiten NULL en datos legacy.
ALTER TABLE public.sales
  ADD CONSTRAINT sales_company_invoice_number_key
  UNIQUE (company_id, invoice_number);

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_company_quotation_number_key
  UNIQUE (company_id, quotation_number);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_company_expense_number_key
  UNIQUE (company_id, expense_number);

COMMIT;
