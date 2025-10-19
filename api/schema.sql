-- Carbon Recycling Platform Database Schema
-- Cloudflare D1 SQLite Database

-- Users table (sync with Clerk)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Integration definitions (metadata from integrations.ts)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL, -- energy, ai, cloud, transport, etc.
  type TEXT NOT NULL, -- oauth, api_key, file_upload, manual_entry, webhook
  description TEXT,
  logo TEXT,
  status TEXT DEFAULT 'production', -- production, beta, development
  authentication_guide TEXT,
  setup_complexity TEXT, -- easy, medium, complex
  estimated_setup_time TEXT,
  data_types JSON, -- Array of data types
  emission_scopes JSON, -- Array of scope1, scope2, scope3
  has_info_page BOOLEAN DEFAULT FALSE,
  has_setup_guide BOOLEAN DEFAULT FALSE,
  has_faq BOOLEAN DEFAULT FALSE,
  api_documentation_url TEXT,
  official_website TEXT,
  oauth_config JSON, -- OAuth configuration if applicable
  api_config JSON, -- API configuration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User integrations (connections)
CREATE TABLE IF NOT EXISTS user_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  display_name TEXT, -- User-customized name
  status TEXT DEFAULT 'pending', -- pending, active, error, disabled
  last_synced_at DATETIME,
  sync_frequency TEXT DEFAULT 'daily', -- daily, hourly, real-time
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES integrations (id) ON DELETE CASCADE,
  UNIQUE(user_id, integration_id)
);

-- Encrypted credentials storage
CREATE TABLE IF NOT EXISTS integration_credentials (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  credential_type TEXT NOT NULL, -- oauth_tokens, api_key, basic_auth
  encrypted_data TEXT NOT NULL, -- Encrypted JSON payload
  expires_at DATETIME, -- For tokens that expire
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE
);

-- OAuth states for security
CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  state TEXT NOT NULL,
  redirect_url TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES integrations (id) ON DELETE CASCADE
);

-- Data sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  sync_type TEXT NOT NULL, -- scheduled, manual, webhook
  status TEXT NOT NULL, -- success, error, partial
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  sync_duration_ms INTEGER,
  data_range_start DATE,
  data_range_end DATE,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE
);

-- Raw data from integrations (before processing)
CREATE TABLE IF NOT EXISTS raw_data (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  data_type TEXT NOT NULL, -- electricity, gas, fuel, api_usage, etc.
  external_id TEXT, -- ID from the source system
  raw_payload JSON NOT NULL, -- Original data from integration
  processed BOOLEAN DEFAULT FALSE,
  record_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE,
  UNIQUE(user_integration_id, external_id, data_type)
);

-- Processed emissions data
CREATE TABLE IF NOT EXISTS emissions_data (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  raw_data_id TEXT,
  emission_source TEXT NOT NULL, -- electricity, gas, transport, cloud, etc.
  activity_amount REAL NOT NULL, -- kWh, litres, tokens, etc.
  activity_unit TEXT NOT NULL, -- kWh, litres, API_calls, etc.
  emission_factor REAL NOT NULL, -- kgCO2e per unit
  emission_factor_source TEXT NOT NULL, -- DEFRA, EPA, etc.
  co2e_amount REAL NOT NULL, -- Total CO2e in kg
  scope TEXT, -- scope1, scope2, scope3
  record_date DATE NOT NULL,
  calculation_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE,
  FOREIGN KEY (raw_data_id) REFERENCES raw_data (id) ON DELETE SET NULL
);

-- Emission factors (regularly updated)
CREATE TABLE IF NOT EXISTS emission_factors (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL, -- electricity, gas, petrol, diesel, etc.
  region TEXT NOT NULL, -- UK, US, EU, etc.
  factor_value REAL NOT NULL, -- kgCO2e per unit
  unit TEXT NOT NULL, -- kWh, litre, etc.
  factor_source TEXT NOT NULL, -- DEFRA, EPA, etc.
  valid_from DATE NOT NULL,
  valid_to DATE,
  renewable_percentage REAL, -- For electricity
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File uploads for CSV integrations
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_url TEXT NOT NULL, -- Cloudflare R2 URL
  upload_status TEXT DEFAULT 'uploaded', -- uploaded, processing, processed, error
  processing_error TEXT,
  records_imported INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE
);

-- Webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  user_integration_id TEXT NOT NULL,
  webhook_source TEXT NOT NULL, -- octopus_energy, etc.
  payload JSON NOT NULL,
  signature TEXT,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_integration_id) REFERENCES user_integrations (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations (status);
CREATE INDEX IF NOT EXISTS idx_user_integrations_last_synced ON user_integrations (last_synced_at);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_integration ON sync_logs (user_integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_raw_data_user_integration ON raw_data (user_integration_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_record_date ON raw_data (record_date);
CREATE INDEX IF NOT EXISTS idx_raw_data_processed ON raw_data (processed);

CREATE INDEX IF NOT EXISTS idx_emissions_data_user_integration ON emissions_data (user_integration_id);
CREATE INDEX IF NOT EXISTS idx_emissions_data_record_date ON emissions_data (record_date);
CREATE INDEX IF NOT EXISTS idx_emissions_data_scope ON emissions_data (scope);

CREATE INDEX IF NOT EXISTS idx_emission_factors_source_region ON emission_factors (source_type, region);
CREATE INDEX IF NOT EXISTS idx_emission_factors_valid_dates ON emission_factors (valid_from, valid_to);

-- Insert default emission factors for UK
INSERT OR REPLACE INTO emission_factors (id, source_type, region, factor_value, unit, factor_source, valid_from) VALUES
  ('uk_electricity_2024', 'electricity', 'UK', 0.193, 'kWh', 'DEFRA 2024', '2024-01-01'),
  ('uk_gas_2024', 'gas', 'UK', 0.182, 'kWh', 'DEFRA 2024', '2024-01-01'),
  ('uk_petrol_2024', 'petrol', 'UK', 2.196, 'litre', 'DEFRA 2024', '2024-01-01'),
  ('uk_diesel_2024', 'diesel', 'UK', 2.534, 'litre', 'DEFRA 2024', '2024-01-01');