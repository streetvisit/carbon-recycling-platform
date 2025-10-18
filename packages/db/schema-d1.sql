-- SQLite schema for Cloudflare D1
-- Converted from MySQL to SQLite syntax

-- Each business customer is an Organization
CREATE TABLE organizations (
  id TEXT PRIMARY KEY, -- e.g., org_xxxxxxxxxxxx
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users belong to an Organization
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- clerk user ID
  organizationId TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX email_org_unique ON users(email, organizationId);

-- A record for each connected data source
CREATE TABLE data_sources (
  id TEXT PRIMARY KEY, -- e.g., ds_xxxxxxxxxxxx
  organizationId TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('api_integration', 'file_upload', 'manual_entry')),
  provider TEXT NOT NULL, -- e.g., 'aws', 'edf_energy', 'csv_fleet_data'
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'error')),
  lastSyncedAt TEXT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Store credentials or connection metadata securely
CREATE TABLE source_credentials (
  dataSourceId TEXT PRIMARY KEY,
  encryptedCredentials TEXT NOT NULL, -- JSON blob of credentials, encrypted at rest
  FOREIGN KEY (dataSourceId) REFERENCES data_sources(id) ON DELETE CASCADE
);

-- MODULE 2: Emissions Calculation Engine Tables

-- Stores raw, unprocessed activity data from various sources
CREATE TABLE activity_data (
  id TEXT PRIMARY KEY, -- e.g., act_xxxxxxxxxxxx
  dataSourceId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  activityType TEXT NOT NULL, -- e.g., 'electricity_usage', 'vehicle_fuel', 'air_travel'
  value REAL NOT NULL, -- The amount of activity (e.g., 1500.0000)
  unit TEXT NOT NULL, -- The unit for the value (e.g., 'kWh', 'litres', 'km')
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  isProcessed INTEGER NOT NULL DEFAULT 0, -- SQLite uses 0/1 for boolean
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dataSourceId) REFERENCES data_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Stores the final calculated emissions data
CREATE TABLE calculated_emissions (
  id TEXT PRIMARY KEY, -- e.g., em_xxxxxxxxxxxx
  activityDataId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  ghgScope TEXT NOT NULL CHECK(ghgScope IN ('scope_1', 'scope_2', 'scope_3')),
  category TEXT NOT NULL, -- e.g., 'Purchased Electricity', 'Business Travel'
  co2e REAL NOT NULL, -- Carbon Dioxide Equivalent in tonnes
  emissionFactorSource TEXT NOT NULL, -- e.g., 'UK DEFRA 2024'
  calculationDate TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activityDataId) REFERENCES activity_data(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- MODULE 3: Analytics Dashboard Indexes
CREATE INDEX idx_org_date_scope ON calculated_emissions(organizationId, calculationDate, ghgScope);
CREATE INDEX idx_org_category ON calculated_emissions(organizationId, category);

-- MODULE 4: Decarbonisation & Reduction Planner Tables

-- Represents a specific decarbonisation project or initiative
CREATE TABLE initiatives (
  id TEXT PRIMARY KEY, -- e.g., init_xxxxxxxxxxxx
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning', 'in_progress', 'completed', 'on_hold')),
  startDate TEXT,
  endDate TEXT,
  estimatedCost REAL,
  projectedCo2eReduction REAL, -- in tonnes per year
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Stores the forecast data points for an initiative's impact
CREATE TABLE emission_forecasts (
  id TEXT PRIMARY KEY,
  initiativeId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  forecastDate TEXT NOT NULL,
  projectedCo2e REAL NOT NULL, -- The projected emissions on this date
  isBaseline INTEGER NOT NULL DEFAULT 0, -- SQLite boolean: True if this is part of the 'business as usual' forecast
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Add indexes for efficient querying of initiatives and forecasts
CREATE INDEX idx_initiatives_org ON initiatives(organizationId, status);
CREATE INDEX idx_forecasts_initiative ON emission_forecasts(initiativeId, forecastDate);
CREATE INDEX idx_forecasts_org_date ON emission_forecasts(organizationId, forecastDate, isBaseline);

-- MODULE 5: Reporting & Compliance Suite Tables

-- Manages generated reports for audit and access
CREATE TABLE reports (
  id TEXT PRIMARY KEY, -- e.g., rept_xxxxxxxxxxxx
  organizationId TEXT NOT NULL,
  reportType TEXT NOT NULL, -- e.g., 'annual_csrd', 'quarterly_summary', 'tcfd_disclosure'
  reportingPeriodStart TEXT NOT NULL,
  reportingPeriodEnd TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating', 'complete', 'failed')),
  fileUrl TEXT, -- Link to the generated PDF in a storage bucket
  version INTEGER NOT NULL DEFAULT 1,
  generatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Add indexes for efficient report querying
CREATE INDEX idx_reports_org ON reports(organizationId, status);
CREATE INDEX idx_reports_type_period ON reports(organizationId, reportType, reportingPeriodStart, reportingPeriodEnd);

-- MODULE 6: SUPPLIER COLLABORATION PORTAL TABLES

-- Stores supplier information linked to a host organization
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY, -- e.g., sup_xxxxxxxxxxxx
  organizationId TEXT NOT NULL, -- The host company
  name TEXT NOT NULL,
  contactEmail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive', 'pending_invite', 'active')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Manages invitations for suppliers to join the portal
CREATE TABLE supplier_invites (
  id TEXT PRIMARY KEY, -- A unique token for the invite link
  supplierId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  invitedByUserId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  isAccepted INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Tracks specific requests for data sent to suppliers
CREATE TABLE data_requests (
  id TEXT PRIMARY KEY, -- e.g., dr_xxxxxxxxxxxx
  organizationId TEXT NOT NULL,
  supplierId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requestedDataType TEXT NOT NULL, -- e.g., 'electricity_usage_kwh', 'total_co2e'
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'in_progress', 'submitted', 'approved')),
  dueDate TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Stores the data submitted by a supplier in response to a request
CREATE TABLE supplier_data_submissions (
  id TEXT PRIMARY KEY,
  dataRequestId TEXT NOT NULL,
  submittedBySupplierId TEXT NOT NULL,
  submittedValue REAL,
  submittedUnit TEXT,
  notes TEXT,
  submittedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dataRequestId) REFERENCES data_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (submittedBySupplierId) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Add indexes for efficient supplier and data request querying
CREATE INDEX idx_suppliers_org ON suppliers(organizationId, status);
CREATE INDEX idx_supplier_invites ON supplier_invites(supplierId, isAccepted);
CREATE INDEX idx_data_requests_org ON data_requests(organizationId, status);
CREATE INDEX idx_data_requests_supplier ON data_requests(supplierId, status, dueDate);
CREATE INDEX idx_supplier_submissions ON supplier_data_submissions(dataRequestId, submittedAt);