-- Migration: Enhance supplier collaboration tables
-- Adds missing columns for enhanced supplier collaboration functionality

-- Add missing columns to suppliers table
ALTER TABLE suppliers ADD COLUMN industry TEXT;
ALTER TABLE suppliers ADD COLUMN country TEXT;
ALTER TABLE suppliers ADD COLUMN relationship TEXT DEFAULT 'other' 
  CHECK(relationship IN ('tier_1', 'tier_2', 'tier_3', 'other'));
ALTER TABLE suppliers ADD COLUMN spendCategory TEXT;
ALTER TABLE suppliers ADD COLUMN estimatedEmissions REAL;

-- Add missing columns to supplier_invites table
ALTER TABLE supplier_invites ADD COLUMN invitedByName TEXT;
ALTER TABLE supplier_invites ADD COLUMN token TEXT;
ALTER TABLE supplier_invites ADD COLUMN acceptedAt TEXT;

-- Update supplier_invites to use token as unique identifier
CREATE UNIQUE INDEX idx_supplier_invite_token ON supplier_invites(token);

-- Add missing columns to data_requests table
ALTER TABLE data_requests ADD COLUMN priority TEXT DEFAULT 'medium'
  CHECK(priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE data_requests ADD COLUMN template TEXT; -- JSON template
ALTER TABLE data_requests ADD COLUMN instructions TEXT;
ALTER TABLE data_requests ADD COLUMN sentAt TEXT;
ALTER TABLE data_requests ADD COLUMN submittedAt TEXT;

-- Update data_requests status to include more states
-- Note: SQLite doesn't support modifying CHECK constraints easily,
-- so we'll handle this in the application layer

-- Add missing columns to supplier_data_submissions table
ALTER TABLE supplier_data_submissions ADD COLUMN supplierId TEXT;
ALTER TABLE supplier_data_submissions ADD COLUMN submittedData TEXT; -- JSON data
ALTER TABLE supplier_data_submissions ADD COLUMN attachments TEXT; -- JSON array of file URLs
ALTER TABLE supplier_data_submissions ADD COLUMN validationStatus TEXT DEFAULT 'pending'
  CHECK(validationStatus IN ('pending', 'validated', 'needs_review', 'rejected'));
ALTER TABLE supplier_data_submissions ADD COLUMN validationNotes TEXT;
ALTER TABLE supplier_data_submissions ADD COLUMN reviewedAt TEXT;
ALTER TABLE supplier_data_submissions ADD COLUMN reviewedBy TEXT;

-- Update foreign key for supplier_data_submissions
-- Add proper supplierId reference (the current submittedBySupplierId will be kept for compatibility)
CREATE INDEX idx_supplier_submissions_supplier ON supplier_data_submissions(supplierId);

-- Add validation status index
CREATE INDEX idx_supplier_submissions_validation ON supplier_data_submissions(validationStatus);

-- Update existing indexes for better performance
CREATE INDEX idx_suppliers_relationship ON suppliers(organizationId, relationship);
CREATE INDEX idx_suppliers_industry ON suppliers(organizationId, industry);
CREATE INDEX idx_data_requests_priority ON data_requests(organizationId, priority, status);
CREATE INDEX idx_data_requests_dates ON data_requests(organizationId, sentAt, submittedAt);