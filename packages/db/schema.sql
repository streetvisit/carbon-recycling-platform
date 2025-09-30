-- schema.sql

-- Each business customer is an Organization
CREATE TABLE `organizations` (
  `id` varchar(255) NOT NULL, -- e.g., org_xxxxxxxxxxxx
  `name` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Users belong to an Organization
CREATE TABLE `users` (
  `id` varchar(255) NOT NULL, -- clerk user ID
  `organizationId` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `role` enum('admin','member') NOT NULL DEFAULT 'member',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_org_unique` (`email`, `organizationId`),
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- A record for each connected data source (e.g., an AWS account, a utility provider)
CREATE TABLE `data_sources` (
  `id` varchar(255) NOT NULL, -- e.g., ds_xxxxxxxxxxxx
  `organizationId` varchar(255) NOT NULL,
  `type` enum('api_integration', 'file_upload', 'manual_entry') NOT NULL,
  `provider` varchar(255) NOT NULL, -- e.g., 'aws', 'edf_energy', 'csv_fleet_data'
  `status` enum('active', 'pending', 'error') NOT NULL DEFAULT 'pending',
  `lastSyncedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Store credentials or connection metadata securely (values should be encrypted)
CREATE TABLE `source_credentials` (
  `dataSourceId` varchar(255) NOT NULL,
  `encryptedCredentials` text NOT NULL, -- JSON blob of credentials, encrypted at rest
  PRIMARY KEY (`dataSourceId`),
  FOREIGN KEY (`dataSourceId`) REFERENCES `data_sources`(`id`) ON DELETE CASCADE
);

-- MODULE 2: Emissions Calculation Engine Tables

-- Stores raw, unprocessed activity data from various sources
CREATE TABLE `activity_data` (
  `id` varchar(255) NOT NULL, -- e.g., act_xxxxxxxxxxxx
  `dataSourceId` varchar(255) NOT NULL,
  `organizationId` varchar(255) NOT NULL,
  `activityType` varchar(255) NOT NULL, -- e.g., 'electricity_usage', 'vehicle_fuel', 'air_travel'
  `value` decimal(18,4) NOT NULL, -- The amount of activity (e.g., 1500.0000)
  `unit` varchar(50) NOT NULL, -- The unit for the value (e.g., 'kWh', 'litres', 'km')
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `isProcessed` boolean NOT NULL DEFAULT false, -- Flag to show if it has been calculated
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`dataSourceId`) REFERENCES `data_sources`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Stores the final calculated emissions data
CREATE TABLE `calculated_emissions` (
  `id` varchar(255) NOT NULL, -- e.g., em_xxxxxxxxxxxx
  `activityDataId` varchar(255) NOT NULL,
  `organizationId` varchar(255) NOT NULL,
  `ghgScope` enum('scope_1', 'scope_2', 'scope_3') NOT NULL,
  `category` varchar(255) NOT NULL, -- e.g., 'Purchased Electricity', 'Business Travel'
  `co2e` decimal(18,6) NOT NULL, -- Carbon Dioxide Equivalent in tonnes
  `emissionFactorSource` varchar(255) NOT NULL, -- e.g., 'UK DEFRA 2024'
  `calculationDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`activityDataId`) REFERENCES `activity_data`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- MODULE 3: Analytics Dashboard Indexes

-- Add indexes to the calculated_emissions table for faster querying
CREATE INDEX `idx_org_date_scope` ON `calculated_emissions` (`organizationId`, `calculationDate`, `ghgScope`);
CREATE INDEX `idx_org_category` ON `calculated_emissions` (`organizationId`, `category`);

-- MODULE 4: Decarbonisation & Reduction Planner Tables

-- Represents a specific decarbonisation project or initiative
CREATE TABLE `initiatives` (
  `id` varchar(255) NOT NULL, -- e.g., init_xxxxxxxxxxxx
  `organizationId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` enum('planning', 'in_progress', 'completed', 'on_hold') NOT NULL DEFAULT 'planning',
  `startDate` date,
  `endDate` date,
  `estimatedCost` decimal(18,2),
  `projectedCo2eReduction` decimal(18,6), -- in tonnes per year
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Stores the forecast data points for an initiative's impact
CREATE TABLE `emission_forecasts` (
  `id` varchar(255) NOT NULL,
  `initiativeId` varchar(255) NOT NULL,
  `organizationId` varchar(255) NOT NULL,
  `forecastDate` date NOT NULL,
  `projectedCo2e` decimal(18,6) NOT NULL, -- The projected emissions on this date
  `isBaseline` boolean NOT NULL DEFAULT false, -- True if this is part of the 'business as usual' forecast
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`initiativeId`) REFERENCES `initiatives`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Add indexes for efficient querying of initiatives and forecasts
CREATE INDEX `idx_initiatives_org` ON `initiatives` (`organizationId`, `status`);
CREATE INDEX `idx_forecasts_initiative` ON `emission_forecasts` (`initiativeId`, `forecastDate`);
CREATE INDEX `idx_forecasts_org_date` ON `emission_forecasts` (`organizationId`, `forecastDate`, `isBaseline`);

-- MODULE 5: Reporting & Compliance Suite Tables

-- Manages generated reports for audit and access
CREATE TABLE `reports` (
  `id` varchar(255) NOT NULL, -- e.g., rept_xxxxxxxxxxxx
  `organizationId` varchar(255) NOT NULL,
  `reportType` varchar(255) NOT NULL, -- e.g., 'annual_csrd', 'quarterly_summary', 'tcfd_disclosure'
  `reportingPeriodStart` date NOT NULL,
  `reportingPeriodEnd` date NOT NULL,
  `status` enum('generating', 'complete', 'failed') NOT NULL DEFAULT 'generating',
  `fileUrl` varchar(1024), -- Link to the generated PDF in a storage bucket
  `version` int NOT NULL DEFAULT 1,
  `generatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Add indexes for efficient report querying
CREATE INDEX `idx_reports_org` ON `reports` (`organizationId`, `status`);
CREATE INDEX `idx_reports_type_period` ON `reports` (`organizationId`, `reportType`, `reportingPeriodStart`, `reportingPeriodEnd`);

-- MODULE 6: SUPPLIER COLLABORATION PORTAL TABLES

-- Stores supplier information linked to a host organization
CREATE TABLE `suppliers` (
  `id` varchar(255) NOT NULL, -- e.g., sup_xxxxxxxxxxxx
  `organizationId` varchar(255) NOT NULL, -- The host company
  `name` varchar(255) NOT NULL,
  `contactEmail` varchar(255) NOT NULL,
  `status` enum('inactive', 'pending_invite', 'active') NOT NULL DEFAULT 'inactive',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Manages invitations for suppliers to join the portal
CREATE TABLE `supplier_invites` (
  `id` varchar(255) NOT NULL, -- A unique token for the invite link
  `supplierId` varchar(255) NOT NULL,
  `organizationId` varchar(255) NOT NULL,
  `invitedByUserId` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `isAccepted` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE
);

-- Tracks specific requests for data sent to suppliers
CREATE TABLE `data_requests` (
  `id` varchar(255) NOT NULL, -- e.g., dr_xxxxxxxxxxxx
  `organizationId` varchar(255) NOT NULL,
  `supplierId` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `requestedDataType` varchar(255) NOT NULL, -- e.g., 'electricity_usage_kwh', 'total_co2e'
  `periodStart` date NOT NULL,
  `periodEnd` date NOT NULL,
  `status` enum('draft', 'sent', 'in_progress', 'submitted', 'approved') NOT NULL DEFAULT 'draft',
  `dueDate` date,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);

-- Stores the data submitted by a supplier in response to a request
CREATE TABLE `supplier_data_submissions` (
  `id` varchar(255) NOT NULL,
  `dataRequestId` varchar(255) NOT NULL,
  `submittedBySupplierId` varchar(255) NOT NULL,
  `submittedValue` decimal(18,4),
  `submittedUnit` varchar(50),
  `notes` text,
  `submittedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`dataRequestId`) REFERENCES `data_requests`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`submittedBySupplierId`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE
);

-- Add indexes for efficient supplier and data request querying
CREATE INDEX `idx_suppliers_org` ON `suppliers` (`organizationId`, `status`);
CREATE INDEX `idx_supplier_invites` ON `supplier_invites` (`supplierId`, `isAccepted`);
CREATE INDEX `idx_data_requests_org` ON `data_requests` (`organizationId`, `status`);
CREATE INDEX `idx_data_requests_supplier` ON `data_requests` (`supplierId`, `status`, `dueDate`);
CREATE INDEX `idx_supplier_submissions` ON `supplier_data_submissions` (`dataRequestId`, `submittedAt`);
