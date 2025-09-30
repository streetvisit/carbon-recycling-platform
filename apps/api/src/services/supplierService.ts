// services/supplierService.ts - Business logic for supplier management

import { 
  Supplier, 
  CreateSupplierRequest, 
  SupplierWithInviteStatus,
  SupplierInvite
} from '../types/suppliers'

// In-memory storage for suppliers (to be replaced with database)
let suppliers: Supplier[] = []
let supplierInvites: SupplierInvite[] = []

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new supplier
 */
export async function createSupplier(organizationId: string, data: CreateSupplierRequest): Promise<Supplier> {
  const supplier: Supplier = {
    id: generateId('sup'),
    organizationId,
    name: data.name,
    contactEmail: data.contactEmail,
    status: 'inactive',
    createdAt: new Date().toISOString()
  }
  
  suppliers.push(supplier)
  return supplier
}

/**
 * Get all suppliers for an organization with invite status
 */
export async function getAllSuppliers(organizationId: string): Promise<SupplierWithInviteStatus[]> {
  const orgSuppliers = suppliers.filter(s => s.organizationId === organizationId)
  
  return orgSuppliers.map(supplier => {
    // Find the latest invite for this supplier
    const latestInvite = supplierInvites
      .filter(invite => invite.supplierId === supplier.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    
    return {
      ...supplier,
      latestInvite,
      pendingRequests: 0, // TODO: Calculate from data_requests
      completedSubmissions: 0 // TODO: Calculate from supplier_data_submissions
    }
  })
}

/**
 * Get a single supplier by ID
 */
export async function getSupplierById(organizationId: string, supplierId: string): Promise<Supplier | null> {
  const supplier = suppliers.find(s => s.id === supplierId && s.organizationId === organizationId)
  return supplier || null
}

/**
 * Update supplier status
 */
export async function updateSupplierStatus(
  organizationId: string, 
  supplierId: string, 
  status: Supplier['status']
): Promise<Supplier | null> {
  const index = suppliers.findIndex(s => s.id === supplierId && s.organizationId === organizationId)
  
  if (index === -1) {
    return null
  }
  
  suppliers[index].status = status
  return suppliers[index]
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(organizationId: string, supplierId: string): Promise<boolean> {
  const index = suppliers.findIndex(s => s.id === supplierId && s.organizationId === organizationId)
  
  if (index === -1) {
    return false
  }
  
  suppliers.splice(index, 1)
  
  // Also clean up any associated invites
  supplierInvites = supplierInvites.filter(invite => invite.supplierId !== supplierId)
  
  return true
}

/**
 * Create a supplier invite
 */
export async function createSupplierInvite(
  organizationId: string,
  supplierId: string,
  invitedByUserId: string,
  expirationDays: number = 30
): Promise<SupplierInvite> {
  // Verify supplier exists
  const supplier = await getSupplierById(organizationId, supplierId)
  if (!supplier) {
    throw new Error('Supplier not found')
  }
  
  // Create invite with unique token
  const invite: SupplierInvite = {
    id: generateId('inv'), // This will be the unique token
    supplierId,
    organizationId,
    invitedByUserId,
    expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString(),
    isAccepted: false,
    createdAt: new Date().toISOString()
  }
  
  supplierInvites.push(invite)
  
  // Update supplier status to pending_invite
  await updateSupplierStatus(organizationId, supplierId, 'pending_invite')
  
  return invite
}

/**
 * Get invite by token (for supplier acceptance)
 */
export async function getInviteByToken(token: string): Promise<SupplierInvite | null> {
  const invite = supplierInvites.find(inv => inv.id === token && !inv.isAccepted)
  
  if (!invite) {
    return null
  }
  
  // Check if invite is expired
  if (new Date(invite.expiresAt) < new Date()) {
    return null
  }
  
  return invite
}

/**
 * Accept a supplier invite
 */
export async function acceptSupplierInvite(token: string): Promise<{ supplier: Supplier; invite: SupplierInvite } | null> {
  const invite = await getInviteByToken(token)
  if (!invite) {
    return null
  }
  
  // Mark invite as accepted
  const inviteIndex = supplierInvites.findIndex(inv => inv.id === token)
  supplierInvites[inviteIndex].isAccepted = true
  
  // Update supplier status to active
  const supplier = await updateSupplierStatus(invite.organizationId, invite.supplierId, 'active')
  
  if (!supplier) {
    throw new Error('Failed to update supplier status')
  }
  
  return { supplier, invite: supplierInvites[inviteIndex] }
}

/**
 * Get supplier by email (for portal login)
 */
export async function getSupplierByEmail(email: string): Promise<Supplier | null> {
  const supplier = suppliers.find(s => s.contactEmail.toLowerCase() === email.toLowerCase() && s.status === 'active')
  return supplier || null
}