-- Add donation metadata fields to Book table
-- This migration adds fields to track who donated the book and when

-- Add donation fields
ALTER TABLE "Book"
ADD COLUMN IF NOT EXISTS donated_by TEXT,
ADD COLUMN IF NOT EXISTS donated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the columns
COMMENT ON COLUMN "Book".donated_by IS 'Name of company/organization that donated this book to the library';
COMMENT ON COLUMN "Book".donated_at IS 'Timestamp when the book was donated to the library';

-- Example: Update a book with donation info
-- UPDATE "Book"
-- SET donated_by = 'PT Everidea Interaktif Nusantara', donated_at = '2025-12-01 00:00:00+07'
-- WHERE id = 1;

-- Verify the migration
SELECT id, title, donated_by, donated_at FROM "Book" LIMIT 5;
