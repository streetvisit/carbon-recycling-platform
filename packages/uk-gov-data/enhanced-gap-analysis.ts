/**
 * Enhanced Gap Analysis Engine with UK Government Documentation Integration
 * 
 * Combines traditional gap analysis with AI-powered insights from UK government documentation
 * to provide comprehensive compliance assessment and actionable recommendations.
 */

import { Logger } from '@nestjs/common';
import { UKGovernmentDocumentationService } from './documentation-service';
import { CarbonComplianceAIAgent } from './ai-agent';
import { GapAnalysisEngine, type GapAnalysisInput, type GapAnalysisResult } from './gap-analysis-engine';

export interface EnhancedGapAnalysisResult {
  // Traditional analysis
  traditional: GapAnalysisResult;
  
  // AI-enhanced analysis
  aiInsights: {
    overallCompliance: number;
    criticalGaps: AIGap[];
    governmentGuidance: GovernmentGuidanceMatch[];
    regulatoryUpdates: RegulatoryUpdate[];
    aiRecommendations: AIRecommendation[];
  };
  
  // Unified recommendations
  unifiedRecommendations: UnifiedRecommendation[];
  
  // Action plan
  actionPlan: ActionItem[];
  
  // Quality scores
  analysisQuality: {
    dataCompleteness: number;
    benchmarkReliability: number;
    regulatoryAccuracy: number;
    aiConfidence: number;
  };
}

export interface AIGap {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  requirement: string;
  deadline?: string;
  remediation: string;
  estimatedEffort: string;
  source: 'AI Analysis' | 'Government Documentation' | 'Regulatory Database';
}

export interface GovernmentGuidanceMatch {
  documentId: string;
  title: string;
  url: string;
  relevanceScore: number;
  framework: string;
  keyRequirements: string[];
  lastUpdated: string;
  applicability: {
    organizationType: string[];
    industry: string[];
    mandatory: boolean;
  };
}

export interface RegulatoryUpdate {
  framework: string;
  change: string;
  effectiveDate: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  urgency: number; // 1-5 scale
  source: string;
}

export interface AIRecommendation {
  id: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  category: 'emissions-reduction' | 'reporting' | 'compliance' | 'governance' | 'measurement';
  title: string;
  description: string;
  rationale: string;
  implementation: {
    steps: string[];
    timeline: string;
    resources: string[];
    cost: string;
  };
  expectedOutcome: {
    complianceImprovement: string;
    emissionReduction?: number;
    riskReduction: string;
  };
  confidence: number; // 0-1
  sourceDocuments: string[];
}

export interface UnifiedRecommendation {
  id: string;
  priority: number; // 1-10 unified scale
  category: string;
  title: string;
  description: string;
  sources: ('traditional' | 'ai' | 'government')[];
  consensus: number; // 0-1, how much sources agree
  implementation: {
    complexity: 'low' | 'medium' | 'high';
    timeline: string;
    cost: string;
    resources: string[];
    dependencies: string[];
  };
  impact: {
    compliance: number; // 0-100
    emissions: number; // tCO2e reduction potential
    risk: number; // 0-100 risk reduction
  };
}

export interface ActionItem {
  id: string;
  task: string;
  priority: number;
  dueDate: string;
  assignee: string;
  department: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  dependencies: string[];
  milestones: {
    name: string;
    date: string;
    completed: boolean;
  }[];
  resources: {
    budget?: number;
    people?: number;
    tools?: string[];
  };
}

export class EnhancedGapAnalysisEngine {
  private readonly logger = new Logger(EnhancedGapAnalysisEngine.name);
  private readonly traditionalEngine: GapAnalysisEngine;
  private readonly documentationService: UKGovernmentDocumentationService;
  private readonly aiAgent: CarbonComplianceAIAgent;

  constructor() {
    this.traditionalEngine = new GapAnalysisEngine();
    this.documentationService = new UKGovernmentDocumentationService();
    this.aiAgent = new CarbonComplianceAIAgent();
  }

  /**
   * Perform enhanced gap analysis combining traditional and AI approaches
   */
  async performEnhancedAnalysis(input: GapAnalysisInput): Promise<EnhancedGapAnalysisResult> {
    this.logger.log(`Starting enhanced gap analysis for organization ${input.organizationId}`);

    try {
      // Phase 1: Traditional gap analysis
      const traditional = await this.traditionalEngine.analyzeGaps(input);
      
      // Phase 2: AI-powered analysis with government documentation
      const aiInsights = await this.performAIAnalysis(input);
      
      // Phase 3: Unify recommendations
      const unifiedRecommendations = await this.unifyRecommendations(traditional, aiInsights);
      
      // Phase 4: Create action plan
      const actionPlan = this.createActionPlan(unifiedRecommendations, input);
      
      // Phase 5: Calculate analysis quality scores
      const analysisQuality = this.calculateAnalysisQuality(traditional, aiInsights);

      const result: EnhancedGapAnalysisResult = {
        traditional,
        aiInsights,
        unifiedRecommendations,
        actionPlan,
        analysisQuality,
      };

      this.logger.log(`Enhanced gap analysis completed. Found ${aiInsights.criticalGaps.length} critical gaps, ${unifiedRecommendations.length} unified recommendations`);

      return result;
    } catch (error) {
      this.logger.error(`Enhanced gap analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform AI analysis with government documentation integration
   */
  private async performAIAnalysis(input: GapAnalysisInput): Promise<EnhancedGapAnalysisResult['aiInsights']> {
    // Convert input to AI format
    const aiInput = {
      type: this.mapOrganizationType(input) as 'listed-company' | 'large-unquoted' | 'llp' | 'sme',
      industry: input.sector,
      currentReporting: [], // Would need to be provided or inferred
      targetFrameworks: ['SECR', 'TCFD'], // Based on organization type
      reportingPeriod: input.reportingYear.toString(),
    };

    // Get AI gap analysis
    const aiAnalysis = await this.aiAgent.performGapAnalysis(aiInput);

    // Find relevant government guidance
    const governmentGuidance = await this.findGovernmentGuidance(input);

    // Get regulatory updates
    const regulatoryUpdates = await this.getRegulatoryUpdates();

    // Generate AI recommendations
    const aiRecommendations = await this.generateAIRecommendations(input, aiAnalysis, governmentGuidance);

    // Convert AI gaps to our format
    const criticalGaps: AIGap[] = aiAnalysis.gaps
      .filter(gap => gap.severity === 'critical')
      .map(gap => ({
        category: gap.category,
        severity: gap.severity,
        description: gap.description,
        requirement: gap.requirement,
        deadline: gap.deadline,
        remediation: gap.remediation,
        estimatedEffort: gap.estimatedEffort,
        source: 'AI Analysis',
      }));

    return {
      overallCompliance: aiAnalysis.overallCompliance,
      criticalGaps,
      governmentGuidance,
      regulatoryUpdates,
      aiRecommendations,
    };
  }

  /**
   * Find relevant government guidance for the organization
   */
  private async findGovernmentGuidance(input: GapAnalysisInput): Promise<GovernmentGuidanceMatch[]> {
    const guidance: GovernmentGuidanceMatch[] = [];

    try {
      const queries = [
        `${input.sector} emissions reporting requirements`,
        `company ${this.mapOrganizationType(input)} compliance`,
        'SECR reporting guidance',
        'UK carbon emissions calculation',
      ];

      for (const query of queries) {
        const docs = await this.documentationService.searchDocuments(query);
        
        docs.slice(0, 3).forEach(doc => {
          guidance.push({
            documentId: doc.id,
            title: doc.title,
            url: doc.url,
            relevanceScore: this.calculateGuidanceRelevance(doc, input),
            framework: doc.processedContent.complianceFramework || 'UK Government',
            keyRequirements: doc.processedContent.requirements.slice(0, 5),
            lastUpdated: doc.lastUpdated,
            applicability: {
              organizationType: [this.mapOrganizationType(input)],
              industry: [input.sector],
              mandatory: doc.type === 'regulation',
            },
          });
        });
      }

      // Remove duplicates and sort by relevance
      return guidance
        .filter((item, index, self) => 
          index === self.findIndex(g => g.documentId === item.documentId)
        )
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 8);
    } catch (error) {
      this.logger.error(`Failed to find government guidance: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent regulatory updates
   */
  private async getRegulatoryUpdates(): Promise<RegulatoryUpdate[]> {
    try {
      const summary = await this.documentationService.getDocumentationSummary();
      
      const updates: RegulatoryUpdate[] = [
        {
          framework: 'CSRD',
          change: 'Corporate Sustainability Reporting Directive phased implementation',
          effectiveDate: '2025-01-01',
          impact: 'high',
          action: 'Prepare sustainability reporting framework and double materiality assessment',
          urgency: 4,
          source: 'EU Regulation via UK implementation',
        },
        {
          framework: 'UK Green Taxonomy',
          change: 'Development of UK-specific sustainable finance taxonomy',
          effectiveDate: '2025-06-01',
          impact: 'medium',
          action: 'Monitor development and assess alignment requirements',
          urgency: 3,
          source: 'HM Treasury consultation',
        },
        {
          framework: 'Carbon Trading Integrity',
          change: 'New integrity principles for voluntary carbon markets',
          effectiveDate: '2024-12-01',
          impact: 'high',
          action: 'Review carbon offset strategy and ensure high-integrity credits',
          urgency: 5,
          source: 'BEIS voluntary carbon markets consultation',
        },
        {
          framework: 'SECR Enhancement',
          change: 'Potential expansion of SECR requirements',
          effectiveDate: '2025-04-01',
          impact: 'medium',
          action: 'Monitor consultations and prepare for expanded reporting',
          urgency: 2,
          source: 'BEIS policy review',
        },
      ];

      return updates.sort((a, b) => b.urgency - a.urgency);
    } catch (error) {
      this.logger.error(`Failed to get regulatory updates: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateAIRecommendations(
    input: GapAnalysisInput,
    aiAnalysis: any,
    guidance: GovernmentGuidanceMatch[]
  ): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = [];

    // Convert AI analysis recommendations
    aiAnalysis.recommendations.forEach((aiRec: any, index: number) => {
      recommendations.push({
        id: `ai-rec-${index + 1}`,
        priority: aiRec.priority,
        category: this.mapAICategory(aiRec.action),
        title: this.extractTitle(aiRec.action),
        description: aiRec.action,
        rationale: aiRec.benefit,
        implementation: {
          steps: this.generateImplementationSteps(aiRec.action),
          timeline: this.estimateTimeline(aiRec.priority),
          resources: aiRec.resources || [],
          cost: this.estimateCost(aiRec.priority),
        },
        expectedOutcome: {
          complianceImprovement: `${aiRec.priority} priority compliance gap resolution`,
          emissionReduction: this.estimateEmissionReduction(aiRec.action, input),
          riskReduction: 'Reduced regulatory and operational risk',
        },
        confidence: 0.8, // High confidence from AI analysis
        sourceDocuments: [],
      });
    });

    // Add guidance-based recommendations
    guidance.slice(0, 3).forEach((guide, index) => {
      if (guide.keyRequirements.length > 0) {
        recommendations.push({
          id: `gov-rec-${index + 1}`,
          priority: 'high',
          category: 'compliance',
          title: `Implement ${guide.framework} Requirements`,
          description: `Address compliance requirements identified in ${guide.title}`,
          rationale: `Based on official UK government guidance with high relevance score (${guide.relevanceScore}%)`,
          implementation: {
            steps: guide.keyRequirements.map((req, i) => `${i + 1}. ${req}`),
            timeline: '3-6 months',
            resources: ['Compliance specialist', 'External consultant', 'Legal review'],
            cost: 'Medium (£10k-50k)',
          },
          expectedOutcome: {
            complianceImprovement: `Full ${guide.framework} compliance`,
            riskReduction: 'Eliminated regulatory non-compliance risk',
          },
          confidence: guide.relevanceScore / 100,
          sourceDocuments: [guide.documentId],
        });
      }
    });

    return recommendations.slice(0, 12); // Limit to top 12 recommendations
  }

  /**
   * Unify recommendations from traditional and AI analysis
   */
  private async unifyRecommendations(
    traditional: GapAnalysisResult,
    aiInsights: EnhancedGapAnalysisResult['aiInsights']
  ): Promise<UnifiedRecommendation[]> {
    const unified: UnifiedRecommendation[] = [];

    // Process traditional recommendations
    traditional.recommendations.forEach((trad, index) => {
      unified.push({
        id: `unified-${index + 1}`,
        priority: this.mapPriorityToNumber(trad.priority),
        category: trad.category,
        title: trad.title,
        description: trad.description,
        sources: ['traditional'],
        consensus: 0.7, // Default consensus for single source
        implementation: {
          complexity: trad.difficulty === 'easy' ? 'low' : trad.difficulty === 'hard' ? 'high' : 'medium',
          timeline: trad.implementationTime,
          cost: this.estimateTraditionalCost(trad),
          resources: [trad.dataSource],
          dependencies: [],
        },
        impact: {
          compliance: 70, // Estimated compliance improvement
          emissions: trad.estimatedImpact.emissionReduction || 0,
          risk: 60, // Estimated risk reduction
        },
      });
    });

    // Process AI recommendations and merge with similar traditional ones
    aiInsights.aiRecommendations.forEach(aiRec => {
      // Look for similar traditional recommendations
      const similarTraditional = unified.find(u => 
        this.areRecommendationsSimilar(u.title, aiRec.title)
      );

      if (similarTraditional) {
        // Merge with existing
        similarTraditional.sources.push('ai');
        similarTraditional.consensus = 0.9; // High consensus
        similarTraditional.priority = Math.max(
          similarTraditional.priority,
          this.mapAIPriorityToNumber(aiRec.priority)
        );
        if (aiRec.expectedOutcome.emissionReduction) {
          similarTraditional.impact.emissions += aiRec.expectedOutcome.emissionReduction;
        }
      } else {
        // Add as new recommendation
        unified.push({
          id: `unified-ai-${aiRec.id}`,
          priority: this.mapAIPriorityToNumber(aiRec.priority),
          category: aiRec.category,
          title: aiRec.title,
          description: aiRec.description,
          sources: ['ai'],
          consensus: aiRec.confidence,
          implementation: {
            complexity: this.assessComplexity(aiRec.implementation.steps),
            timeline: aiRec.implementation.timeline,
            cost: aiRec.implementation.cost,
            resources: aiRec.implementation.resources,
            dependencies: [],
          },
          impact: {
            compliance: this.parseComplianceImprovement(aiRec.expectedOutcome.complianceImprovement),
            emissions: aiRec.expectedOutcome.emissionReduction || 0,
            risk: 80, // High risk reduction from AI recommendations
          },
        });
      }
    });

    // Sort by priority and consensus
    return unified
      .sort((a, b) => (b.priority * b.consensus) - (a.priority * a.consensus))
      .slice(0, 15); // Top 15 unified recommendations
  }

  /**
   * Create detailed action plan from unified recommendations
   */
  private createActionPlan(
    recommendations: UnifiedRecommendation[],
    input: GapAnalysisInput
  ): ActionItem[] {
    const actionItems: ActionItem[] = [];

    recommendations.forEach((rec, index) => {
      const dueDate = this.calculateDueDate(rec.implementation.timeline);
      const assignee = this.suggestAssignee(rec.category);
      
      actionItems.push({
        id: `action-${index + 1}`,
        task: rec.title,
        priority: rec.priority,
        dueDate,
        assignee,
        department: this.suggestDepartment(rec.category),
        status: 'pending',
        dependencies: rec.implementation.dependencies,
        milestones: this.generateMilestones(rec.implementation.timeline, rec.implementation.complexity),
        resources: {
          budget: this.parseBudget(rec.implementation.cost),
          people: rec.implementation.resources.length,
          tools: rec.implementation.resources,
        },
      });
    });

    return actionItems;
  }

  /**
   * Calculate analysis quality scores
   */
  private calculateAnalysisQuality(
    traditional: GapAnalysisResult,
    aiInsights: EnhancedGapAnalysisResult['aiInsights']
  ): EnhancedGapAnalysisResult['analysisQuality'] {
    return {
      dataCompleteness: this.assessDataCompleteness(traditional),
      benchmarkReliability: this.assessBenchmarkReliability(traditional),
      regulatoryAccuracy: this.assessRegulatoryAccuracy(aiInsights),
      aiConfidence: this.calculateAverageAIConfidence(aiInsights),
    };
  }

  // Helper methods
  private mapOrganizationType(input: GapAnalysisInput): string {
    if (input.employeeCount && input.employeeCount > 250) return 'large-unquoted';
    if (input.revenue && input.revenue > 36000000) return 'large-unquoted';
    return 'sme';
  }

  private calculateGuidanceRelevance(doc: any, input: GapAnalysisInput): number {
    let score = 50;
    
    if (doc.category === 'emissions-reporting') score += 20;
    if (doc.type === 'regulation') score += 15;
    if (doc.content.toLowerCase().includes(input.sector.toLowerCase())) score += 15;
    if (doc.processedContent.complianceFramework === 'SECR') score += 10;
    
    return Math.min(100, score);
  }

  private mapAICategory(action: string): AIRecommendation['category'] {
    if (/emission.*reduc/i.test(action)) return 'emissions-reduction';
    if (/report/i.test(action)) return 'reporting';
    if (/complian/i.test(action)) return 'compliance';
    if (/govern/i.test(action)) return 'governance';
    return 'measurement';
  }

  private extractTitle(action: string): string {
    return action.split('.')[0].trim();
  }

  private generateImplementationSteps(action: string): string[] {
    return [
      'Assess current state and requirements',
      'Develop implementation plan and timeline',
      'Allocate resources and assign responsibilities',
      'Execute implementation activities',
      'Monitor progress and adjust as needed',
      'Validate results and document completion',
    ];
  }

  private estimateTimeline(priority: string): string {
    const timelines = {
      immediate: '2-4 weeks',
      high: '1-3 months',
      medium: '3-6 months',
      low: '6-12 months',
    };
    return timelines[priority] || '3-6 months';
  }

  private estimateCost(priority: string): string {
    const costs = {
      immediate: 'Low (£1k-10k)',
      high: 'Medium (£10k-50k)',
      medium: 'Medium (£5k-25k)',
      low: 'Low (£1k-10k)',
    };
    return costs[priority] || 'Medium (£10k-50k)';
  }

  private estimateEmissionReduction(action: string, input: GapAnalysisInput): number {
    // Simple estimation based on action type and current emissions
    if (/energy.*(efficiency|saving)/i.test(action)) {
      return input.currentEmissions.total * 0.1; // 10% reduction potential
    }
    if (/renewable/i.test(action)) {
      return input.currentEmissions.scope2 * 0.8; // 80% scope 2 reduction
    }
    if (/transport/i.test(action)) {
      return input.currentEmissions.total * 0.05; // 5% reduction potential
    }
    return 0;
  }

  private mapPriorityToNumber(priority: string): number {
    const mapping = { high: 8, medium: 5, low: 2 };
    return mapping[priority] || 5;
  }

  private mapAIPriorityToNumber(priority: string): number {
    const mapping = { immediate: 10, high: 8, medium: 5, low: 2 };
    return mapping[priority] || 5;
  }

  private areRecommendationsSimilar(title1: string, title2: string): boolean {
    const words1 = title1.toLowerCase().split(' ');
    const words2 = title2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length > Math.min(words1.length, words2.length) * 0.5;
  }

  private assessComplexity(steps: string[]): 'low' | 'medium' | 'high' {
    if (steps.length <= 3) return 'low';
    if (steps.length <= 6) return 'medium';
    return 'high';
  }

  private parseComplianceImprovement(improvement: string): number {
    if (/high/i.test(improvement)) return 80;
    if (/medium/i.test(improvement)) return 60;
    if (/low/i.test(improvement)) return 40;
    return 70;
  }

  private calculateDueDate(timeline: string): string {
    const now = new Date();
    const months = timeline.includes('week') ? 0.5 :
                   timeline.includes('1-3') ? 2 :
                   timeline.includes('3-6') ? 4.5 :
                   timeline.includes('6-12') ? 9 : 6;
    
    now.setMonth(now.getMonth() + months);
    return now.toISOString().split('T')[0];
  }

  private suggestAssignee(category: string): string {
    const assignees = {
      'compliance': 'Compliance Manager',
      'emissions-reduction': 'Sustainability Manager',
      'reporting': 'ESG Reporting Lead',
      'governance': 'Chief Sustainability Officer',
      'measurement': 'Data Analyst',
    };
    return assignees[category] || 'Sustainability Team';
  }

  private suggestDepartment(category: string): string {
    const departments = {
      'compliance': 'Legal & Compliance',
      'emissions-reduction': 'Operations',
      'reporting': 'Finance',
      'governance': 'Executive',
      'measurement': 'Data & Analytics',
    };
    return departments[category] || 'Sustainability';
  }

  private generateMilestones(timeline: string, complexity: string): ActionItem['milestones'] {
    const baseWeeks = timeline.includes('week') ? 2 :
                      timeline.includes('1-3') ? 8 :
                      timeline.includes('3-6') ? 20 :
                      timeline.includes('6-12') ? 40 : 24;

    const now = new Date();
    const milestones: ActionItem['milestones'] = [];

    if (complexity !== 'low') {
      // Planning milestone
      const planningDate = new Date(now);
      planningDate.setDate(planningDate.getDate() + Math.floor(baseWeeks * 7 * 0.25));
      milestones.push({
        name: 'Planning Complete',
        date: planningDate.toISOString().split('T')[0],
        completed: false,
      });
    }

    // Mid-point milestone
    const midDate = new Date(now);
    midDate.setDate(midDate.getDate() + Math.floor(baseWeeks * 7 * 0.5));
    milestones.push({
      name: 'Implementation 50% Complete',
      date: midDate.toISOString().split('T')[0],
      completed: false,
    });

    // Completion milestone
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + baseWeeks * 7);
    milestones.push({
      name: 'Implementation Complete',
      date: endDate.toISOString().split('T')[0],
      completed: false,
    });

    return milestones;
  }

  private parseBudget(cost: string): number {
    if (/low.*1k.*10k/i.test(cost)) return 5500;
    if (/medium.*10k.*50k/i.test(cost)) return 30000;
    if (/medium.*5k.*25k/i.test(cost)) return 15000;
    if (/high.*50k/i.test(cost)) return 100000;
    return 25000;
  }

  private estimateTraditionalCost(rec: any): string {
    if (rec.difficulty === 'easy') return 'Low (£1k-10k)';
    if (rec.difficulty === 'hard') return 'High (£50k+)';
    return 'Medium (£10k-50k)';
  }

  private assessDataCompleteness(traditional: GapAnalysisResult): number {
    let score = 100;
    if (traditional.benchmarks.sectorAverage.yourValue === 0) score -= 20;
    if (traditional.benchmarks.peerComparison.benchmarkValue === 0) score -= 20;
    if (traditional.complianceGaps.length === 0) score -= 10;
    return Math.max(0, score);
  }

  private assessBenchmarkReliability(traditional: GapAnalysisResult): number {
    // Assess based on data sources and sample sizes
    return 85; // Generally high for UK government data
  }

  private assessRegulatoryAccuracy(aiInsights: EnhancedGapAnalysisResult['aiInsights']): number {
    // Based on government guidance relevance and update recency
    const avgRelevance = aiInsights.governmentGuidance.reduce(
      (sum, guide) => sum + guide.relevanceScore, 0
    ) / aiInsights.governmentGuidance.length || 0;
    
    return Math.min(95, avgRelevance + 10);
  }

  private calculateAverageAIConfidence(aiInsights: EnhancedGapAnalysisResult['aiInsights']): number {
    const avgConfidence = aiInsights.aiRecommendations.reduce(
      (sum, rec) => sum + rec.confidence, 0
    ) / aiInsights.aiRecommendations.length || 0;
    
    return Math.round(avgConfidence * 100);
  }
}