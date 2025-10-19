# Report Generation API

The Report Generation system provides automated PDF report creation for compliance and sustainability reporting. It aggregates data from all modules to create professional, branded reports suitable for regulatory submissions and stakeholder communication.

## Overview

The system provides the following key features:

- **Multi-format Reports**: Support for CSRD, TCFD, GRI, and custom report formats
- **Automated PDF Generation**: Uses Browserless.io for high-quality PDF rendering
- **Cloud Storage**: Stores completed reports in Cloudflare R2 storage
- **Template System**: Customizable HTML templates with data injection
- **Progress Tracking**: Real-time status monitoring during generation
- **Download Management**: Secure download links and access control

## Core Entities

### Report
```typescript
interface Report {
  id: string;
  organizationId: string;
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  status: 'generating' | 'complete' | 'failed';
  fileUrl?: string;
  version: number;
  generatedAt: string;
}
```

### ReportGenerationData
```typescript
interface ReportGenerationData {
  organizationId: string;
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  emissionsSummary: {
    totalCo2e: number;
    byScope: {
      scope_1: number;
      scope_2: number;
      scope_3: number;
    };
  };
  emissionsBreakdown: Array<{
    category: string;
    scope: string;
    totalCo2e: number;
    percentage: number;
  }>;
  initiatives: Array<{
    name: string;
    status: string;
    projectedCo2eReduction: number;
    estimatedCost?: number;
  }>;
  timeseriesData: Array<{
    date: string;
    totalCo2e: number;
  }>;
}
```

## API Endpoints

### Report Management

#### GET /api/v1/reports
List all reports for the organization.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rept_abc123",
      "organizationId": "org_xyz789",
      "reportType": "annual_summary",
      "reportingPeriodStart": "2024-01-01",
      "reportingPeriodEnd": "2024-12-31",
      "status": "complete",
      "fileUrl": "https://r2.cloudflare.com/bucket/reports/rept_abc123.pdf",
      "version": 1,
      "generatedAt": "2024-10-19T17:40:46Z"
    }
  ],
  "count": 1
}
```

#### POST /api/v1/reports
Create a new report and start generation.

**Request Body:**
```json
{
  "reportType": "annual_summary",
  "reportingPeriodStart": "2024-01-01",
  "reportingPeriodEnd": "2024-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rept_abc123",
    "status": "generating"
  },
  "message": "Report generation started"
}
```

#### GET /api/v1/reports/:id
Get report by ID.

#### DELETE /api/v1/reports/:id
Delete report by ID.

### Report Generation

#### POST /api/v1/reports/:id/regenerate
Regenerate an existing report with updated data.

#### GET /api/v1/reports/:id/download
Download report PDF (redirects to file URL).

**Response:**
- `302 Redirect` to the PDF file URL (if report is complete)
- `400 Bad Request` if report is not ready
- `404 Not Found` if report doesn't exist

### Report Types

#### GET /api/v1/reports/types
Get available report types.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "annual_summary",
      "name": "Annual Summary",
      "description": "Comprehensive yearly emissions report with analytics and initiatives"
    },
    {
      "type": "quarterly_summary",
      "name": "Quarterly Summary", 
      "description": "Quarterly emissions overview with key metrics and trends"
    },
    {
      "type": "csrd_disclosure",
      "name": "CSRD Disclosure",
      "description": "Corporate Sustainability Reporting Directive compliance report"
    },
    {
      "type": "tcfd_disclosure",
      "name": "TCFD Disclosure",
      "description": "Task Force on Climate-related Financial Disclosures report"
    },
    {
      "type": "gri_report",
      "name": "GRI Standards Report",
      "description": "Global Reporting Initiative sustainability standards report"
    }
  ]
}
```

### Analytics

#### GET /api/v1/reports/dashboard
Get reports dashboard data.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 15,
      "completed": 12,
      "failed": 1,
      "generating": 2
    },
    "recentReports": [
      {
        "id": "rept_abc123",
        "reportType": "annual_summary",
        "status": "complete",
        "generatedAt": "2024-10-19T17:40:46Z"
      }
    ],
    "byType": {
      "annual_summary": 5,
      "quarterly_summary": 8,
      "csrd_disclosure": 2
    },
    "availableTypes": [...]
  }
}
```

## Test Endpoints

For development and demonstration purposes:

#### POST /api/v1/reports-test/create-sample-data
Creates sample activity data and emissions calculations for report generation.

#### POST /api/v1/reports-test/demo-annual-report
Creates a demo annual report.

#### POST /api/v1/reports-test/demo-all-report-types
Creates sample reports for all available report types.

## Report Generation Process

The system follows a comprehensive data aggregation and PDF generation workflow:

### Step 1: Data Aggregation
- **Emissions Summary**: Total CO2e by scope from calculation engine
- **Emissions Breakdown**: Category-wise breakdown with percentages
- **Timeseries Data**: Monthly/quarterly emissions trends
- **Initiative Data**: Decarbonization projects and projected reductions

### Step 2: Template Processing
- **HTML Generation**: Inject data into report-specific templates
- **Chart Creation**: Generate Chart.js visualizations for trends
- **Styling**: Apply professional CSS styling and branding
- **Layout**: Multi-page layout with headers, footers, and page breaks

### Step 3: PDF Creation
- **Browserless Integration**: Convert HTML to PDF using Browserless.io
- **Quality Settings**: A4 format, print backgrounds, proper margins
- **Headers/Footers**: Page numbers and report identification

### Step 4: Storage
- **R2 Upload**: Store PDF in Cloudflare R2 with AWS S3 compatibility
- **Access Control**: Generate signed URLs for secure download
- **Metadata**: Update database with file URL and status

### Step 5: Delivery
- **Status Updates**: Real-time progress tracking
- **Download Links**: Secure access to completed reports
- **Version Control**: Support for report regeneration

## Environment Configuration

The report generation system requires several environment variables:

```env
# Browserless.io Configuration
BROWSERLESS_API_KEY=your_browserless_api_key
BROWSERLESS_ENDPOINT=https://chrome.browserless.io

# Cloudflare R2 Storage Configuration  
R2_BUCKET_NAME=your-bucket-name
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

### Browserless.io Setup
1. Sign up for a Browserless.io account
2. Get your API key from the dashboard
3. Set the `BROWSERLESS_API_KEY` environment variable

### Cloudflare R2 Setup
1. Create a Cloudflare R2 bucket for report storage
2. Generate API credentials with S3 compatibility
3. Configure the R2 environment variables

## Report Templates

The system includes professional templates for each report type:

### Common Features
- **Branding**: CarbonRecycling.co.uk logo and styling
- **Responsive Design**: Optimized for PDF generation
- **Professional Layout**: Clean typography and spacing
- **Data Visualization**: Chart.js integration for graphs
- **Multi-page Support**: Page breaks and navigation

### Template Customization
Templates can be customized by modifying:
- **HTML Structure**: Layout and content organization
- **CSS Styling**: Colors, fonts, and visual design
- **Data Placeholders**: Dynamic content injection points
- **Chart Configuration**: Visualization types and styling

## Error Handling

The system provides comprehensive error handling:

### Common Errors
- **Missing Data**: Insufficient emissions data for report period
- **Template Errors**: HTML/CSS rendering issues
- **PDF Generation**: Browserless.io service failures
- **Storage Errors**: R2 upload failures
- **Authentication**: Invalid credentials or permissions

### Error Responses
```json
{
  "success": false,
  "error": "Error message describing the issue",
  "details": "Additional context for debugging"
}
```

### Status Codes
- `200` - Success
- `201` - Report created
- `400` - Bad request / validation error
- `401` - Authentication required
- `404` - Report not found
- `500` - Generation failure

## Workflow Example

Here's a typical report generation workflow:

1. **Create Report**: POST to `/api/v1/reports` with report type and period
2. **Monitor Progress**: GET `/api/v1/reports/:id` to check status
3. **Download PDF**: GET `/api/v1/reports/:id/download` when complete
4. **Share Report**: Use the file URL for stakeholder distribution

## Integration Notes

The report generation system integrates with:

- **Emissions Calculation Engine**: Source data for all emissions metrics
- **Analytics Dashboard**: Timeseries and breakdown data
- **Initiative Planner**: Decarbonization project information
- **Supplier Portal**: Supply chain emissions data (when available)
- **Cloud Storage**: Secure file storage and access management
- **External Services**: Browserless.io for PDF generation

## Security Considerations

- **Access Control**: Reports are scoped to organization access
- **Secure Storage**: Files stored with access controls in R2
- **Download Links**: Time-limited signed URLs for security
- **Data Privacy**: Sensitive data is protected throughout the process
- **Audit Trail**: All report generation activities are logged

## Performance Considerations

- **Async Processing**: Report generation runs in background
- **Queue Management**: Large organizations may need job queuing
- **Caching**: Template compilation can be cached for efficiency
- **Resource Limits**: PDF generation has memory and time constraints
- **File Size**: Large reports may require optimization

## Production Deployment

For production deployment:

1. **Environment Variables**: Configure all required service credentials
2. **Service Dependencies**: Ensure Browserless.io and R2 availability
3. **Queue System**: Consider implementing job queues for scale
4. **Monitoring**: Set up alerts for generation failures
5. **Backup Strategy**: Plan for report data backup and recovery