/**
 * Supplier Collaboration Service
 * 
 * Manages supplier portal functionality:
 * - Supplier invitation management
 * - Data request workflows
 * - Submission processing and validation
 * - Communication and notifications
 * - Progress tracking and reporting
 */

import { getD1Database, generateId } from '../../../../../packages/db/d1-connection';

export interface Supplier {
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

export interface SupplierInvite {
  id: string;
  supplierId: string;
  organizationId: string;
  invitedByUserId: string;
  invitedByName: string;
  token: string; // Unique invite token for secure access
  expiresAt: string;
  isAccepted: boolean;
  acceptedAt?: string;
  createdAt: string;
}

export interface DataRequest {
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
  template?: any; // JSON template for structured data
  instructions?: string;
  createdAt: string;
  sentAt?: string;
  submittedAt?: string;
}

export interface SupplierSubmission {
  id: string;
  dataRequestId: string;
  supplierId: string;
  submittedValue?: number;
  submittedUnit?: string;
  submittedData?: any; // JSON structured data
  notes?: string;
  attachments?: string[]; // File URLs/paths
  validationStatus: 'pending' | 'validated' | 'needs_review' | 'rejected';
  validationNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CollaborationMetrics {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingInvites: number;
  totalDataRequests: number;
  pendingRequests: number;
  completedRequests: number;
  avgResponseTime: number; // days
  completionRate: number; // percentage
}

export class SupplierCollaborationService {
  private env: any;
  
  constructor(env: any) {
    this.env = env;
  }

  /**
   * Create a new supplier
   */
  async createSupplier(
    organizationId: string,
    supplierData: {
      name: string;
      contactEmail: string;
      industry?: string;
      country?: string;
      relationship?: 'tier_1' | 'tier_2' | 'tier_3' | 'other';
      spendCategory?: string;
      estimatedEmissions?: number;
    }
  ): Promise<Supplier> {
    const db = getD1Database(this.env);
    const id = generateId('sup');
    const createdAt = new Date().toISOString();

    const supplier: Supplier = {
      id,
      organizationId,
      status: 'inactive',
      createdAt,
      ...supplierData,
      relationship: supplierData.relationship || 'other'
    };

    await db.prepare(`
      INSERT INTO suppliers (
        id, organizationId, name, contactEmail, status, industry, country,
        relationship, spendCategory, estimatedEmissions, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, organizationId, supplier.name, supplier.contactEmail, 'inactive',
      supplier.industry, supplier.country, supplier.relationship,
      supplier.spendCategory, supplier.estimatedEmissions, createdAt
    ).run();

    return supplier;
  }

  /**
   * Send invitation to supplier
   */
  async sendSupplierInvite(
    organizationId: string,
    supplierId: string,
    invitedByUserId: string,
    invitedByName: string,
    customMessage?: string
  ): Promise<SupplierInvite> {
    const db = getD1Database(this.env);
    
    // Verify supplier exists and belongs to organization
    const supplier = await this.getSupplierById(organizationId, supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Generate secure invite token
    const token = this.generateSecureToken();
    const inviteId = generateId('inv');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
    const createdAt = new Date().toISOString();

    const invite: SupplierInvite = {
      id: inviteId,
      supplierId,
      organizationId,
      invitedByUserId,
      invitedByName,
      token,
      expiresAt,
      isAccepted: false,
      createdAt
    };

    // Save invite to database
    await db.prepare(`
      INSERT INTO supplier_invites (
        id, supplierId, organizationId, invitedByUserId, token, expiresAt, 
        isAccepted, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      inviteId, supplierId, organizationId, invitedByUserId, token, 
      expiresAt, false, createdAt
    ).run();

    // Update supplier status
    await db.prepare(`
      UPDATE suppliers SET status = 'pending_invite' WHERE id = ?
    `).bind(supplierId).run();

    // Send invitation email (this would integrate with an email service)
    await this.sendInvitationEmail(supplier, invite, invitedByName, customMessage);

    return invite;
  }

  /**
   * Validate supplier invitation (without accepting)
   */
  async validateInvitation(token: string): Promise<{ 
    success: boolean; 
    error?: string; 
    hostCompanyName?: string;
    invitedByName?: string;
    supplierEmail?: string;
  }> {
    const db = getD1Database(this.env);
    
    // Find and validate invite
    const invite = await db.prepare(`
      SELECT si.*, s.name as supplierName, s.contactEmail, o.name as hostCompanyName
      FROM supplier_invites si
      JOIN suppliers s ON si.supplierId = s.id
      JOIN organizations o ON si.organizationId = o.id
      WHERE si.token = ? AND si.expiresAt > datetime('now') AND si.isAccepted = 0
    `).bind(token).first();

    if (!invite) {
      return { success: false, error: 'Invalid or expired invitation' };
    }

    return { 
      success: true, 
      hostCompanyName: invite.hostCompanyName,
      invitedByName: invite.invitedByName,
      supplierEmail: invite.contactEmail
    };
  }

  /**
   * Accept supplier invitation
   */
  async acceptInvitation(token: string): Promise<{ success: boolean; supplierId?: string; error?: string }> {
    const db = getD1Database(this.env);
    
    // Find and validate invite
    const invite = await db.prepare(`
      SELECT * FROM supplier_invites 
      WHERE token = ? AND expiresAt > datetime('now') AND isAccepted = 0
    `).bind(token).first() as SupplierInvite | null;

    if (!invite) {
      return { success: false, error: 'Invalid or expired invitation' };
    }

    const acceptedAt = new Date().toISOString();

    // Update invite as accepted
    await db.prepare(`
      UPDATE supplier_invites 
      SET isAccepted = 1, acceptedAt = ? 
      WHERE id = ?
    `).bind(acceptedAt, invite.id).run();

    // Update supplier status to active
    await db.prepare(`
      UPDATE suppliers SET status = 'active' WHERE id = ?
    `).bind(invite.supplierId).run();

    return { success: true, supplierId: invite.supplierId };
  }

  /**
   * Create data request to supplier
   */
  async createDataRequest(
    organizationId: string,
    requestData: {
      supplierId: string;
      title: string;
      description: string;
      requestedDataType: string;
      periodStart: string;
      periodEnd: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      dueDate?: string;
      template?: any;
      instructions?: string;
    }
  ): Promise<DataRequest> {
    const db = getD1Database(this.env);
    
    // Verify supplier is active
    const supplier = await this.getSupplierById(organizationId, requestData.supplierId);
    if (!supplier || supplier.status !== 'active') {
      throw new Error('Supplier must be active to receive data requests');
    }

    const id = generateId('dr');
    const createdAt = new Date().toISOString();

    const dataRequest: DataRequest = {
      id,
      organizationId,
      status: 'draft',
      createdAt,
      priority: 'medium',
      ...requestData
    };

    await db.prepare(`
      INSERT INTO data_requests (
        id, organizationId, supplierId, title, description, requestedDataType,
        periodStart, periodEnd, status, priority, dueDate, template, 
        instructions, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, organizationId, requestData.supplierId, requestData.title,
      requestData.description, requestData.requestedDataType,
      requestData.periodStart, requestData.periodEnd, 'draft',
      dataRequest.priority, requestData.dueDate,
      requestData.template ? JSON.stringify(requestData.template) : null,
      requestData.instructions, createdAt
    ).run();

    return dataRequest;
  }

  /**
   * Send data request to supplier
   */
  async sendDataRequest(organizationId: string, dataRequestId: string): Promise<void> {
    const db = getD1Database(this.env);
    const sentAt = new Date().toISOString();

    // Get request details
    const request = await db.prepare(`
      SELECT dr.*, s.name as supplierName, s.contactEmail 
      FROM data_requests dr
      JOIN suppliers s ON dr.supplierId = s.id
      WHERE dr.id = ? AND dr.organizationId = ?
    `).bind(dataRequestId, organizationId).first();

    if (!request) {
      throw new Error('Data request not found');
    }

    if (request.status !== 'draft') {
      throw new Error('Only draft requests can be sent');
    }

    // Update status to sent
    await db.prepare(`
      UPDATE data_requests 
      SET status = 'sent', sentAt = ? 
      WHERE id = ?
    `).bind(sentAt, dataRequestId).run();

    // Send notification email to supplier
    await this.sendDataRequestEmail(request);
  }

  /**
   * Submit data response from supplier
   */
  async submitSupplierData(
    supplierId: string,
    dataRequestId: string,
    submissionData: {
      submittedValue?: number;
      submittedUnit?: string;
      submittedData?: any;
      notes?: string;
      attachments?: string[];
    }
  ): Promise<SupplierSubmission> {
    const db = getD1Database(this.env);
    
    // Verify request exists and belongs to supplier
    const request = await db.prepare(`
      SELECT * FROM data_requests 
      WHERE id = ? AND supplierId = ? AND status IN ('sent', 'in_progress')
    `).bind(dataRequestId, supplierId).first();

    if (!request) {
      throw new Error('Data request not found or not available for submission');
    }

    const submissionId = generateId('sub');
    const submittedAt = new Date().toISOString();

    const submission: SupplierSubmission = {
      id: submissionId,
      dataRequestId,
      supplierId,
      validationStatus: 'pending',
      submittedAt,
      ...submissionData
    };

    // Save submission
    await db.prepare(`
      INSERT INTO supplier_data_submissions (
        id, dataRequestId, supplierId, submittedValue, submittedUnit,
        submittedData, notes, attachments, validationStatus, submittedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      submissionId, dataRequestId, supplierId, submission.submittedValue,
      submission.submittedUnit, 
      submission.submittedData ? JSON.stringify(submission.submittedData) : null,
      submission.notes,
      submission.attachments ? JSON.stringify(submission.attachments) : null,
      'pending', submittedAt
    ).run();

    // Update request status
    await db.prepare(`
      UPDATE data_requests 
      SET status = 'submitted', submittedAt = ? 
      WHERE id = ?
    `).bind(submittedAt, dataRequestId).run();

    return submission;
  }

  /**
   * Validate and approve supplier submission
   */
  async validateSubmission(
    organizationId: string,
    submissionId: string,
    validationData: {
      validationStatus: 'validated' | 'needs_review' | 'rejected';
      validationNotes?: string;
      reviewedBy: string;
    }
  ): Promise<void> {
    const db = getD1Database(this.env);
    
    // Verify submission belongs to organization
    const submission = await db.prepare(`
      SELECT s.*, dr.organizationId 
      FROM supplier_data_submissions s
      JOIN data_requests dr ON s.dataRequestId = dr.id
      WHERE s.id = ? AND dr.organizationId = ?
    `).bind(submissionId, organizationId).first();

    if (!submission) {
      throw new Error('Submission not found');
    }

    const reviewedAt = new Date().toISOString();

    // Update submission validation
    await db.prepare(`
      UPDATE supplier_data_submissions 
      SET validationStatus = ?, validationNotes = ?, reviewedAt = ?, reviewedBy = ?
      WHERE id = ?
    `).bind(
      validationData.validationStatus,
      validationData.validationNotes,
      reviewedAt,
      validationData.reviewedBy,
      submissionId
    ).run();

    // Update request status based on validation
    const requestStatus = validationData.validationStatus === 'validated' ? 'approved' : 
                         validationData.validationStatus === 'rejected' ? 'rejected' : 'submitted';

    await db.prepare(`
      UPDATE data_requests SET status = ? WHERE id = ?
    `).bind(requestStatus, submission.dataRequestId).run();
  }

  /**
   * Get suppliers for organization
   */
  async getSuppliers(
    organizationId: string,
    filters: { status?: string; industry?: string; relationship?: string } = {}
  ): Promise<Supplier[]> {
    const db = getD1Database(this.env);
    
    let query = 'SELECT * FROM suppliers WHERE organizationId = ?';
    const params = [organizationId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.industry) {
      query += ' AND industry = ?';
      params.push(filters.industry);
    }
    if (filters.relationship) {
      query += ' AND relationship = ?';
      params.push(filters.relationship);
    }

    query += ' ORDER BY name ASC';

    const result = await db.prepare(query).bind(...params).all();
    return result.results as Supplier[];
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(organizationId: string, supplierId: string): Promise<Supplier | null> {
    const db = getD1Database(this.env);
    
    const result = await db.prepare(`
      SELECT * FROM suppliers WHERE id = ? AND organizationId = ?
    `).bind(supplierId, organizationId).first();

    return result ? result as Supplier : null;
  }

  /**
   * Get data requests for organization
   */
  async getDataRequests(
    organizationId: string,
    filters: { status?: string; supplierId?: string; priority?: string } = {}
  ): Promise<DataRequest[]> {
    const db = getD1Database(this.env);
    
    let query = `
      SELECT dr.*, s.name as supplierName 
      FROM data_requests dr
      JOIN suppliers s ON dr.supplierId = s.id
      WHERE dr.organizationId = ?
    `;
    const params = [organizationId];

    if (filters.status) {
      query += ' AND dr.status = ?';
      params.push(filters.status);
    }
    if (filters.supplierId) {
      query += ' AND dr.supplierId = ?';
      params.push(filters.supplierId);
    }
    if (filters.priority) {
      query += ' AND dr.priority = ?';
      params.push(filters.priority);
    }

    query += ' ORDER BY dr.createdAt DESC';

    const result = await db.prepare(query).bind(...params).all();
    return result.results as DataRequest[];
  }

  /**
   * Get submissions for data request
   */
  async getSubmissions(dataRequestId: string): Promise<SupplierSubmission[]> {
    const db = getD1Database(this.env);
    
    const result = await db.prepare(`
      SELECT * FROM supplier_data_submissions 
      WHERE dataRequestId = ? 
      ORDER BY submittedAt DESC
    `).bind(dataRequestId).all();

    return result.results as SupplierSubmission[];
  }

  /**
   * Get collaboration metrics
   */
  async getCollaborationMetrics(organizationId: string): Promise<CollaborationMetrics> {
    const db = getD1Database(this.env);
    
    // Get supplier counts
    const supplierStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'pending_invite' THEN 1 ELSE 0 END) as pendingInvites
      FROM suppliers WHERE organizationId = ?
    `).bind(organizationId).first();

    // Get request counts
    const requestStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('sent', 'in_progress', 'submitted') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as completed
      FROM data_requests WHERE organizationId = ?
    `).bind(organizationId).first();

    // Calculate average response time
    const avgResponseResult = await db.prepare(`
      SELECT AVG(
        julianday(submittedAt) - julianday(sentAt)
      ) as avgResponseTime
      FROM data_requests 
      WHERE organizationId = ? AND sentAt IS NOT NULL AND submittedAt IS NOT NULL
    `).bind(organizationId).first();

    const totalRequests = requestStats?.total || 0;
    const completedRequests = requestStats?.completed || 0;
    const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

    return {
      totalSuppliers: supplierStats?.total || 0,
      activeSuppliers: supplierStats?.active || 0,
      pendingInvites: supplierStats?.pendingInvites || 0,
      totalDataRequests: totalRequests,
      pendingRequests: requestStats?.pending || 0,
      completedRequests,
      avgResponseTime: avgResponseResult?.avgResponseTime || 0,
      completionRate: Math.round(completionRate * 10) / 10
    };
  }

  /**
   * Generate secure token for invites
   */
  private generateSecureToken(): string {
    return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/[+/=]/g, '')
      .substring(0, 32);
  }

  /**
   * Send invitation email (placeholder - would integrate with email service)
   */
  private async sendInvitationEmail(
    supplier: Supplier, 
    invite: SupplierInvite, 
    invitedByName: string,
    customMessage?: string
  ): Promise<void> {
    console.log(`Sending invitation email to ${supplier.contactEmail}`);
    console.log(`Invite link: ${process.env.FRONTEND_URL}/supplier/invite/${invite.token}`);
    
    // This would integrate with an email service like SendGrid, AWS SES, etc.
    // For now, just log the invitation details
  }

  /**
   * Get supplier by token (for portal authentication)
   */
  async getSupplierByToken(token: string): Promise<Supplier | null> {
    const db = getD1Database(this.env);
    
    // Check if token matches an active invitation
    const invite = await db.prepare(`
      SELECT s.* FROM suppliers s
      JOIN supplier_invites si ON s.id = si.supplierId
      WHERE si.token = ? AND s.status = 'active'
    `).bind(token).first();
    
    return invite ? invite as Supplier : null;
  }

  /**
   * Get data requests for a specific supplier
   */
  async getDataRequestsBySupplier(
    supplierId: string,
    filters: { status?: string; limit?: number } = {}
  ): Promise<DataRequest[]> {
    const db = getD1Database(this.env);
    
    let query = `
      SELECT dr.*, o.name as hostCompanyName
      FROM data_requests dr
      JOIN organizations o ON dr.organizationId = o.id
      WHERE dr.supplierId = ?
    `;
    const params = [supplierId];
    
    if (filters.status) {
      query += ' AND dr.status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY dr.createdAt DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit.toString());
    }
    
    const result = await db.prepare(query).bind(...params).all();
    return result.results as DataRequest[];
  }

  /**
   * Get data request by ID for a specific supplier
   */
  async getDataRequestByIdForSupplier(
    supplierId: string,
    requestId: string
  ): Promise<DataRequest | null> {
    const db = getD1Database(this.env);
    
    const result = await db.prepare(`
      SELECT dr.*, o.name as hostCompanyName
      FROM data_requests dr
      JOIN organizations o ON dr.organizationId = o.id
      WHERE dr.id = ? AND dr.supplierId = ?
    `).bind(requestId, supplierId).first();
    
    return result ? result as DataRequest : null;
  }

  /**
   * Get submissions by supplier
   */
  async getSubmissionsBySupplier(
    supplierId: string,
    filters: { limit?: number } = {}
  ): Promise<SupplierSubmission[]> {
    const db = getD1Database(this.env);
    
    let query = `
      SELECT sds.*, dr.title as requestTitle
      FROM supplier_data_submissions sds
      JOIN data_requests dr ON sds.dataRequestId = dr.id
      WHERE sds.supplierId = ?
      ORDER BY sds.submittedAt DESC
    `;
    const params = [supplierId];
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit.toString());
    }
    
    const result = await db.prepare(query).bind(...params).all();
    return result.results as SupplierSubmission[];
  }

  /**
   * Send data request email (placeholder)
   */
  private async sendDataRequestEmail(request: any): Promise<void> {
    console.log(`Sending data request email to ${request.contactEmail}`);
    console.log(`Request: ${request.title}`);
    
    // This would integrate with an email service
  }
}
