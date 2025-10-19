# Supplier Collaboration Portal API

The Supplier Collaboration Portal enables organizations to manage their supply chain emissions data collection through a structured workflow of supplier invitations, data requests, and submissions.

## Overview

The system provides the following key features:

- **Supplier Management**: Register and categorize suppliers with relationship tiers and spend categories
- **Invitation System**: Send secure invitations to suppliers with unique tokens
- **Data Requests**: Create structured requests for emissions data with templates and deadlines
- **Submission Processing**: Collect, validate, and approve supplier data submissions
- **Analytics & Reporting**: Track collaboration metrics and progress

## Core Entities

### Supplier
```typescript
interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contactEmail: string;
  status: 'inactive' | 'pending_invite' | 'active';
  industry?: string;
  country?: string;
  relationship: 'tier_1' | 'tier_2' | 'tier_3' | 'other';
  spendCategory?: string;
  estimatedEmissions?: number;
  createdAt: string;
}
```

### DataRequest
```typescript
interface DataRequest {
  id: string;
  organizationId: string;
  supplierId: string;
  title: string;
  description: string;
  requestedDataType: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'sent' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  template?: any;
  instructions?: string;
  createdAt: string;
}
```

### SupplierSubmission
```typescript
interface SupplierSubmission {
  id: string;
  dataRequestId: string;
  supplierId: string;
  submittedValue?: number;
  submittedUnit?: string;
  submittedData?: any;
  notes?: string;
  attachments?: string[];
  validationStatus: 'pending' | 'validated' | 'needs_review' | 'rejected';
  validationNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
```

## API Endpoints

### Supplier Management

#### GET /api/v1/suppliers
List suppliers for the organization.

**Query Parameters:**
- `status` (optional): Filter by supplier status
- `industry` (optional): Filter by industry
- `relationship` (optional): Filter by relationship tier

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sup_abc123",
      "name": "Green Energy Solutions Ltd",
      "contactEmail": "contact@greenenergy.co.uk",
      "status": "active",
      "industry": "Energy",
      "relationship": "tier_1"
    }
  ],
  "count": 1
}
```

#### POST /api/v1/suppliers
Create a new supplier.

**Request Body:**
```json
{
  "name": "Green Energy Solutions Ltd",
  "contactEmail": "contact@greenenergy.co.uk",
  "industry": "Energy",
  "country": "United Kingdom",
  "relationship": "tier_1",
  "spendCategory": "Utilities",
  "estimatedEmissions": 1200.5
}
```

#### GET /api/v1/suppliers/:id
Get supplier by ID.

### Invitation System

#### POST /api/v1/suppliers/invite
Send invitation to supplier.

**Request Body:**
```json
{
  "supplierId": "sup_abc123",
  "customMessage": "Welcome to our supplier collaboration portal!"
}
```

#### POST /api/v1/suppliers/invite/accept/:token
Accept supplier invitation (public endpoint for suppliers).

### Data Request Management

#### GET /api/v1/suppliers/data-requests
List data requests for the organization.

**Query Parameters:**
- `status` (optional): Filter by request status
- `supplierId` (optional): Filter by supplier ID
- `priority` (optional): Filter by priority

#### POST /api/v1/suppliers/data-requests
Create a new data request.

**Request Body:**
```json
{
  "supplierId": "sup_abc123",
  "title": "Quarterly Electricity Consumption",
  "description": "Please provide your electricity consumption data for Q1 2024",
  "requestedDataType": "electricity_usage",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-03-31",
  "priority": "high",
  "dueDate": "2024-04-15T00:00:00.000Z",
  "instructions": "Please provide data in kWh with supporting documentation",
  "template": {
    "monthly_breakdown": {
      "january": { "unit": "kWh", "required": true },
      "february": { "unit": "kWh", "required": true },
      "march": { "unit": "kWh", "required": true }
    }
  }
}
```

#### POST /api/v1/suppliers/data-requests/:id/send
Send data request to supplier.

#### GET /api/v1/suppliers/data-requests/:id/submissions
Get submissions for a data request.

### Data Submission

#### POST /api/v1/suppliers/data-requests/:id/submit
Submit data for a request (supplier endpoint).

**Request Body:**
```json
{
  "supplierId": "sup_abc123",
  "submittedValue": 1500,
  "submittedUnit": "kWh",
  "submittedData": {
    "january": 520,
    "february": 480,
    "march": 500
  },
  "notes": "Electricity consumption for Q1 2024",
  "attachments": [
    "https://storage.example.com/invoices/q1-electricity.pdf"
  ]
}
```

#### POST /api/v1/suppliers/submissions/:id/validate
Validate and approve/reject supplier submission.

**Request Body:**
```json
{
  "validationStatus": "validated",
  "validationNotes": "Data looks accurate and complete"
}
```

### Analytics & Reporting

#### GET /api/v1/suppliers/metrics
Get collaboration metrics and analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSuppliers": 15,
    "activeSuppliers": 12,
    "pendingInvites": 3,
    "totalDataRequests": 45,
    "pendingRequests": 8,
    "completedRequests": 32,
    "avgResponseTime": 7.5,
    "completionRate": 71.1
  }
}
```

#### GET /api/v1/suppliers/dashboard
Get dashboard summary data.

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": { /* collaboration metrics */ },
    "recentRequests": [
      {
        "id": "dr_xyz789",
        "title": "Annual Carbon Footprint Report",
        "status": "sent",
        "priority": "critical",
        "dueDate": "2024-05-01T00:00:00.000Z"
      }
    ],
    "activeSuppliers": [
      {
        "id": "sup_abc123",
        "name": "Green Energy Solutions Ltd",
        "status": "active"
      }
    ],
    "summary": {
      "needsAttention": 2,
      "overdueRequests": 1
    }
  }
}
```

## Test Endpoints

For development and demonstration purposes, the following test endpoints are available:

### POST /api/v1/suppliers-test/create-sample-suppliers
Creates sample suppliers for testing.

### POST /api/v1/suppliers-test/create-sample-requests
Creates sample data requests for testing.

### POST /api/v1/suppliers-test/demo-workflow
Demonstrates a complete supplier collaboration workflow from creation to validation.

## Database Migration

Before using the supplier collaboration features, run the database migration:

### POST /api/v1/admin/migrate-supplier-tables
Runs the database migration to add enhanced supplier collaboration tables.

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Authentication Required
- `404` - Not Found
- `500` - Internal Server Error

## Workflow Example

Here's a typical supplier collaboration workflow:

1. **Create Supplier**: Add supplier information to the system
2. **Send Invitation**: Send secure invitation link to supplier
3. **Accept Invitation**: Supplier accepts invitation and activates their account
4. **Create Data Request**: Create structured request for specific data
5. **Send Request**: Notify supplier about the data request
6. **Submit Data**: Supplier submits requested data through the portal
7. **Validate Submission**: Review and approve/reject supplier submission
8. **Generate Reports**: Use validated data for emissions calculations and reporting

## Security Considerations

- All endpoints require authentication via the organization's API key or user session
- Supplier invitations use secure tokens with expiration dates
- Data submissions are validated before being accepted
- Sensitive data is encrypted at rest and in transit
- Access logs are maintained for audit purposes

## Integration Notes

The supplier collaboration system integrates with:

- **Emissions Calculation Engine**: Validated supplier data feeds into emissions calculations
- **Reporting System**: Supplier data is included in sustainability reports
- **Analytics Dashboard**: Real-time metrics and progress tracking
- **Notification System**: Email notifications for invitations and requests (email service integration required)