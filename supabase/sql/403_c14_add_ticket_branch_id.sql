-- C14: Add branch_id column to tickets table

-- Add branch_id column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS branch_id uuid;

-- Add index for fast filtering by branch
CREATE INDEX IF NOT EXISTS idx_tickets_branch_id ON public.tickets(branch_id);

-- Create a default branch if none exists (for backfill purposes)
INSERT INTO public.branches (id, name, address, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Default Branch',
    'Default Address',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.branches LIMIT 1);

-- Backfill existing tickets with a default branch_id
-- This is a simplified approach - in real implementation you'd have more sophisticated logic
UPDATE public.tickets
SET branch_id = (
    SELECT id FROM public.branches
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE branch_id IS NULL;

-- Make branch_id required now that all records are populated
ALTER TABLE public.tickets ALTER COLUMN branch_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.tickets ADD CONSTRAINT fk_tickets_branch
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE SET NULL;