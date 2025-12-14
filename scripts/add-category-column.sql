-- Add category column to Book table
-- This migration adds a category/genre field to track book categories

-- Add category column with default value 'Fiksi'
ALTER TABLE "Book"
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Fiksi';

-- Update existing books to have 'Fiksi' category
UPDATE "Book"
SET category = 'Fiksi'
WHERE category IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN "Book".category IS 'Book category/genre (e.g., Fiksi, Non-Fiksi, Sejarah, Teknologi, Sains, Biografi)';

-- Verify the migration
SELECT id, title, category FROM "Book" LIMIT 5;
