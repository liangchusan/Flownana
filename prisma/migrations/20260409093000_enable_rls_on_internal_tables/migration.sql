-- Enable RLS on internal application tables exposed through the public schema.
-- This keeps Supabase Security Advisor quiet and prevents accidental PostgREST
-- access from anon/authenticated roles unless explicit policies are added later.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedStripeEvent" ENABLE ROW LEVEL SECURITY;
