-- Conscious skip ("won't do today") with a reason
ALTER TABLE entries ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN skip_reason TEXT;
