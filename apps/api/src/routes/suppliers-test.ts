/**
 * Supplier Collaboration Test Routes
 * 
 * Provides test endpoints to demonstrate supplier collaboration features
 */

import { Hono } from 'hono';
import { SupplierCollaborationService } from '../services/supplierCollaborationService';
import { authMiddleware } from '../middleware/auth';

const suppliersTest = new Hono();

// Apply authentication middleware
suppliersTest.use('*', authMiddleware);

/**
 * POST /test/create-sample-suppliers
 * Create sample suppliers for testing
 */
suppliersTest.post('/create-sample-suppliers', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const service = new SupplierCollaborationService(c.env);
    
    // Sample supplier data
    const sampleSuppliers = [
      {
        name: 'Green Energy Solutions Ltd',
        contactEmail: 'contact@greenenergy.co.uk',
        industry: 'Energy',
        country: 'United Kingdom',
        relationship: 'tier_1' as const,
        spendCategory: 'Utilities',
        estimatedEmissions: 1200.5
      },
      {
        name: 'Sustainable Transport Co.',
        contactEmail: 'info@sustrans.com',
        industry: 'Transportation',
        country: 'United Kingdom', 
        relationship: 'tier_2' as const,
        spendCategory: 'Logistics',
        estimatedEmissions: 890.2
      },
      {
        name: 'EcoMaterials Inc.',
        contactEmail: 'orders@ecomaterials.com',
        industry: 'Manufacturing',
        country: 'Germany',
        relationship: 'tier_1' as const,
        spendCategory: 'Raw Materials',
        estimatedEmissions: 2500.8
      },
      {
        name: 'Digital Cloud Services',
        contactEmail: 'support@cloudtech.io',
        industry: 'Technology',
        country: 'Ireland',
        relationship: 'tier_3' as const,
        spendCategory: 'IT Services',
        estimatedEmissions: 156.3
      }
    ];
    
    const createdSuppliers = [];
    
    for (const supplierData of sampleSuppliers) {
      const supplier = await service.createSupplier(organizationId, supplierData);
      createdSuppliers.push(supplier);
    }
    
    return c.json({
      success: true,
      message: `Created ${createdSuppliers.length} sample suppliers`,
      data: createdSuppliers
    });
  } catch (error) {
    console.error('Error creating sample suppliers:', error);
    return c.json({
      success: false,
      error: 'Failed to create sample suppliers'
    }, 500);
  }
});

/**
 * POST /test/create-sample-requests
 * Create sample data requests for testing
 */
suppliersTest.post('/create-sample-requests', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const service = new SupplierCollaborationService(c.env);
    
    // Get active suppliers
    const suppliers = await service.getSuppliers(organizationId, { status: 'active' });
    
    if (suppliers.length === 0) {
      return c.json({
        success: false,
        error: 'No active suppliers found. Create and activate suppliers first.'
      }, 400);
    }
    
    // Sample data requests
    const sampleRequests = [
      {
        title: 'Quarterly Electricity Consumption',
        description: 'Please provide your electricity consumption data for Q1 2024',
        requestedDataType: 'electricity_usage',
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        priority: 'high' as const,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
        instructions: 'Please provide data in kWh with supporting documentation'
      },
      {
        title: 'Annual Carbon Footprint Report',
        description: 'Submit your complete Scope 1, 2, and 3 emissions data',
        requestedDataType: 'carbon_emissions',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        priority: 'critical' as const,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 month from now
        instructions: 'Include methodology and verification documents',
        template: {
          scope_1: { unit: 'tCO2e', required: true },
          scope_2: { unit: 'tCO2e', required: true },
          scope_3: { unit: 'tCO2e', required: false }
        }
      },
      {
        title: 'Fleet Vehicle Data',
        description: 'Provide vehicle fuel consumption and mileage data',
        requestedDataType: 'transport_emissions',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
        priority: 'medium' as const,
        instructions: 'Include vehicle type, fuel type, and consumption data'
      }
    ];
    
    const createdRequests = [];
    
    // Create requests for different suppliers
    for (let i = 0; i < Math.min(sampleRequests.length, suppliers.length); i++) {
      const requestData = {
        ...sampleRequests[i],
        supplierId: suppliers[i].id
      };
      
      const request = await service.createDataRequest(organizationId, requestData);
      createdRequests.push(request);
    }
    
    return c.json({
      success: true,
      message: `Created ${createdRequests.length} sample data requests`,
      data: createdRequests
    });
  } catch (error) {
    console.error('Error creating sample requests:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to create sample requests'
    }, 500);
  }
});

/**
 * POST /test/demo-workflow
 * Demonstrate a complete supplier collaboration workflow
 */
suppliersTest.post('/demo-workflow', async (c) => {
  try {
    const { organizationId, userId, name } = c.get('user');
    const service = new SupplierCollaborationService(c.env);
    
    const workflow = [];
    
    // Step 1: Create a supplier
    const supplier = await service.createSupplier(organizationId, {
      name: 'Demo Supplier Ltd',
      contactEmail: 'demo@supplier.com',
      industry: 'Manufacturing',
      country: 'United Kingdom',
      relationship: 'tier_1',
      spendCategory: 'Components',
      estimatedEmissions: 500.0
    });
    
    workflow.push({
      step: 1,
      action: 'Created supplier',
      data: supplier
    });
    
    // Step 2: Send invitation
    const invite = await service.sendSupplierInvite(
      organizationId,
      supplier.id,
      userId,
      name || 'Demo User',
      'Welcome to our supplier collaboration portal!'
    );
    
    workflow.push({
      step: 2,
      action: 'Sent invitation',
      data: invite
    });
    
    // Step 3: Accept invitation (simulate)
    const acceptResult = await service.acceptInvitation(invite.token);
    
    workflow.push({
      step: 3,
      action: 'Accepted invitation',
      data: acceptResult
    });
    
    // Step 4: Create data request
    const dataRequest = await service.createDataRequest(organizationId, {
      supplierId: supplier.id,
      title: 'Demo Data Request',
      description: 'Please provide your energy consumption data',
      requestedDataType: 'energy_consumption',
      periodStart: '2024-01-01',
      periodEnd: '2024-03-31',
      priority: 'medium',
      instructions: 'Provide data in kWh format'
    });
    
    workflow.push({
      step: 4,
      action: 'Created data request',
      data: dataRequest
    });
    
    // Step 5: Send data request
    await service.sendDataRequest(organizationId, dataRequest.id);
    
    workflow.push({
      step: 5,
      action: 'Sent data request',
      data: { requestId: dataRequest.id }
    });
    
    // Step 6: Submit data (simulate supplier response)
    const submission = await service.submitSupplierData(
      supplier.id,
      dataRequest.id,
      {
        submittedValue: 1500,
        submittedUnit: 'kWh',
        notes: 'Electricity consumption for Q1 2024',
        submittedData: {
          january: 520,
          february: 480,
          march: 500
        }
      }
    );
    
    workflow.push({
      step: 6,
      action: 'Submitted data',
      data: submission
    });
    
    // Step 7: Validate submission
    await service.validateSubmission(
      organizationId,
      submission.id,
      {
        validationStatus: 'validated',
        validationNotes: 'Data looks accurate and complete',
        reviewedBy: name || 'Demo User'
      }
    );
    
    workflow.push({
      step: 7,
      action: 'Validated submission',
      data: { submissionId: submission.id, status: 'validated' }
    });
    
    // Step 8: Get metrics
    const metrics = await service.getCollaborationMetrics(organizationId);
    
    workflow.push({
      step: 8,
      action: 'Generated metrics',
      data: metrics
    });
    
    return c.json({
      success: true,
      message: 'Demo workflow completed successfully',
      workflow,
      summary: {
        totalSteps: workflow.length,
        supplierId: supplier.id,
        dataRequestId: dataRequest.id,
        submissionId: submission.id
      }
    });
  } catch (error) {
    console.error('Error running demo workflow:', error);
    return c.json({
      success: false,
      error: error.message || 'Demo workflow failed'
    }, 500);
  }
});

export { suppliersTest };