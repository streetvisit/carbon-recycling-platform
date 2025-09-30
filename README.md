# CarbonRecycling.co.uk - Enterprise Carbon & ESG Management Platform

## Module 1: Data Ingestion & Integration Hub

This is the foundational module responsible for connecting to and collecting all necessary data for carbon calculation.

### Architecture

- **Frontend**: Astro with Preact interactive islands, styled with Tailwind CSS
- **Backend**: Cloudflare Workers with Hono framework
- **Database**: PlanetScale (MySQL-compatible serverless)
- **Authentication**: Clerk.dev
- **Language**: TypeScript throughout
- **Package Management**: pnpm workspaces

### Project Structure

```
carbon-recycling-platform/
├── apps/
│   ├── web/          # Astro frontend application
│   └── api/          # Cloudflare Workers API
├── packages/
│   └── db/           # Database schema and types
├── package.json      # Root package.json with workspace config
└── pnpm-workspace.yaml
```

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install -g pnpm  # If not already installed
   pnpm install
   ```

2. **Start development servers**:
   ```bash
   pnpm dev  # Starts both frontend and API servers
   ```

   Or start individually:
   ```bash
   # Frontend (Astro) - runs on http://localhost:4321
   pnpm --filter web dev
   
   # API (Cloudflare Workers) - runs on http://localhost:8787
   pnpm --filter api dev
   ```

3. **Access the application**:
   - Homepage: http://localhost:4321
   - Data Ingestion Hub: http://localhost:4321/dashboard/ingestion

### Features Implemented

#### Step 1: Project Scaffolding ✅
- pnpm workspace setup
- Astro frontend with Preact and Tailwind
- Cloudflare Worker API with Hono

#### Step 2: Database Schema ✅
- Organizations, Users, Data Sources, and Credentials tables
- TypeScript types for all entities

#### Step 3: Backend API Endpoints ✅
- `GET /api/v1/datasources` - Fetch organization's data sources
- `POST /api/v1/datasources` - Create new data source
- `DELETE /api/v1/datasources/:id` - Delete data source
- Mock authentication middleware (Clerk integration ready)

#### Step 4: Frontend UI Components ✅
- `DashboardHeader` - Header with "Add New Data Source" button
- `IntegrationGrid` - Grid of available integrations
- `DataSourceList` - Lists connected data sources with actions
- `AddDataSourceModal` - Modal for selecting and connecting integrations

#### Step 5: Main Page Integration ✅
- Protected dashboard route at `/dashboard/ingestion`
- Homepage with navigation to ingestion hub
- Integrated state management between components

#### Step 6: Finalization ✅
- Error handling for API calls
- Loading states and user feedback
- Complete user flow from empty state to connected sources

### Available Integrations

The platform supports connecting to various data sources:

- **AWS** (API Integration) - EC2, S3, and other service usage data
- **Microsoft Azure** (API Integration) - Cloud infrastructure emissions
- **EDF Energy** (API Integration) - Electricity consumption data
- **Fleet Data Upload** (File Upload) - Vehicle and fuel consumption CSV files
- **Facilities Data Upload** (File Upload) - Office and facility energy CSV files
- **Manual Data Entry** - Direct input for smaller data sources

### Current State

The application is currently using mock data and authentication for development purposes. The next steps for production readiness would include:

1. **Database Integration**: Connect to PlanetScale database
2. **Authentication**: Implement proper Clerk.dev integration
3. **Data Processing**: Add actual data ingestion and processing logic
4. **Error Handling**: Enhance error handling and user feedback
5. **Testing**: Add unit and integration tests
6. **Deployment**: Set up CI/CD for Cloudflare Pages and Workers

### Technology Stack Details

- **Astro 4.x** - Modern web framework with excellent DX
- **Preact** - Lightweight React alternative for interactive components
- **Tailwind CSS** - Utility-first CSS framework
- **Hono** - Fast, lightweight web framework for Cloudflare Workers
- **Clerk.dev** - Complete user management and authentication
- **PlanetScale** - Serverless MySQL database
- **TypeScript** - Type safety throughout the application

### Future Modules

This Data Ingestion Hub is designed to support the following future modules:

- **Module 2**: Calculation Engine (GHG Protocol carbon footprint calculations)
- **Module 3**: Analytics Dashboard (emission hotspots, trends, benchmarks)
- **Module 4**: Decarbonisation Planner (reduction scenarios, climate projects)
- **Module 5**: Reporting Suite (CSRD and TCFD compliance reports)
- **Module 6**: Supplier Portal (Scope 3 data collaboration)