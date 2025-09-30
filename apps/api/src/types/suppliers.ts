// types/suppliers.ts - TypeScript types for Module 6: Supplier Portal

export interface Supplier {
  id: string
  organizationId: string
  name: string
  contactEmail: string
  status: 'inactive' | 'pending_invite' | 'active'
  createdAt: string
}

export interface SupplierInvite {
  id: string
  supplierId: string
  organizationId: string
  invitedByUserId: string
  expiresAt: string
  isAccepted: boolean
  createdAt: string
}

export interface DataRequest {
  id: string
  organizationId: string
  supplierId: string
  title: string
  description?: string
  requestedDataType: string
  periodStart: string
  periodEnd: string
  status: 'draft' | 'sent' | 'in_progress' | 'submitted' | 'approved'
  dueDate?: string
  createdAt: string
}

export interface SupplierDataSubmission {
  id: string
  dataRequestId: string
  submittedBySupplierId: string
  submittedValue?: number
  submittedUnit?: string
  notes?: string
  submittedAt: string
}

// Request DTOs
export interface CreateSupplierRequest {
  name: string
  contactEmail: string
}

export interface CreateSupplierInviteRequest {
  supplierId: string
  expirationDays?: number // defaults to 30
}

export interface CreateDataRequestRequest {
  supplierId: string
  title: string
  description?: string
  requestedDataType: string
  periodStart: string
  periodEnd: string
  dueDate?: string
}

export interface SubmitDataRequest {
  submittedValue?: number
  submittedUnit?: string
  notes?: string
}

// Extended types with joined data
export interface DataRequestWithSupplier extends DataRequest {
  supplier: Supplier
}

export interface DataRequestWithSubmissions extends DataRequest {
  submissions: SupplierDataSubmission[]
  supplier: Supplier
}

export interface SupplierWithInviteStatus extends Supplier {
  latestInvite?: SupplierInvite
  pendingRequests?: number
  completedSubmissions?: number
}