// services/initiativeService.ts - CRUD operations for initiatives

import { Initiative, CreateInitiativeRequest, UpdateInitiativeRequest, InitiativeWithForecasts } from '../types/initiatives';

// Mock database - in production this would connect to PlanetScale
let mockInitiatives: Initiative[] = [];
let idCounter = 1;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createInitiative(
  organizationId: string,
  data: CreateInitiativeRequest & { projectedCo2eReduction: number }
): Promise<Initiative> {
  const initiative: Initiative = {
    id: generateId('init'),
    organizationId,
    name: data.name,
    description: data.description || null,
    status: 'planning',
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    estimatedCost: data.estimatedCost || null,
    projectedCo2eReduction: data.projectedCo2eReduction,
    createdAt: new Date().toISOString(),
  };

  mockInitiatives.push(initiative);
  return initiative;
}

export async function getAllInitiatives(organizationId: string): Promise<Initiative[]> {
  return mockInitiatives.filter(initiative => initiative.organizationId === organizationId);
}

export async function getInitiativeById(
  organizationId: string, 
  initiativeId: string
): Promise<Initiative | null> {
  return mockInitiatives.find(
    initiative => initiative.id === initiativeId && initiative.organizationId === organizationId
  ) || null;
}

export async function updateInitiative(
  organizationId: string,
  initiativeId: string,
  updates: UpdateInitiativeRequest
): Promise<Initiative | null> {
  const index = mockInitiatives.findIndex(
    initiative => initiative.id === initiativeId && initiative.organizationId === organizationId
  );

  if (index === -1) {
    return null;
  }

  // Update only provided fields
  const initiative = mockInitiatives[index];
  mockInitiatives[index] = {
    ...initiative,
    ...Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ),
  };

  return mockInitiatives[index];
}

export async function deleteInitiative(
  organizationId: string,
  initiativeId: string
): Promise<boolean> {
  const index = mockInitiatives.findIndex(
    initiative => initiative.id === initiativeId && initiative.organizationId === organizationId
  );

  if (index === -1) {
    return false;
  }

  mockInitiatives.splice(index, 1);
  return true;
}

// Helper to get categories with emissions for the organization
export async function getAvailableCategories(organizationId: string): Promise<Array<{category: string, totalCo2e: number}>> {
  // Mock data - in production would query calculated_emissions table
  return [
    { category: 'Purchased Electricity', totalCo2e: 15.5 },
    { category: 'Business Travel', totalCo2e: 8.3 },
    { category: 'Company Vehicles', totalCo2e: 12.1 },
    { category: 'Waste Generated', totalCo2e: 2.7 },
    { category: 'Water Supply', totalCo2e: 1.2 }
  ];
}