import { Logger } from '@nestjs/common';
import { UKGovernmentDocumentationService } from './documentation-service';

interface AIAgentQuery {
  question: string;
  context?: {
    organizationType?: 'listed-company' | 'large-unquoted' | 'llp' | 'sme';
    industry?: string;
    currentEmissions?: number;
    reportingPeriod?: string;
    complianceFrameworks?: string[];
  };
  preferredResponseStyle?: 'concise' | 'detailed' | 'technical' | 'executive';
}

interface AIAgentResponse {
  answer: string;
  confidence: number;
  sources: {
    documentId: string;
    title: string;
    url: string;
    relevantSection: string;
    complianceFramework: string;
  }[];
  recommendations: string[];
  nextSteps: string[];
  relatedQuestions: string[];
  metadata: {
    processingTime: number;
    documentsSearched: number;
    regulatoryUpdates?: string[];
  };
}

interface ComplianceGapAnalysis {
  overallCompliance: number;
  gaps: {
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    requirement: string;
    deadline?: string;
    remediation: string;
    estimatedEffort: string;
  }[];
  recommendations: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    action: string;
    benefit: string;
    resources: string[];
  }[];
  regulatoryContext: {
    framework: string;
    lastUpdated: string;
    upcomingChanges: string[];
  }[];
}

export class CarbonComplianceAIAgent {
  private readonly logger = new Logger(CarbonComplianceAIAgent.name);
  private readonly documentationService: UKGovernmentDocumentationService;
  
  // Knowledge base patterns for intelligent matching
  private readonly knowledgePatterns = {
    emissions: /emission|carbon|co2|greenhouse gas|scope [123]/i,
    reporting: /report|disclosure|tcfd|secr|csrd|gri/i,
    calculation: /calculat|factor|method|formula/i,
    trading: /credit|trading|offset|carbon market/i,
    compliance: /complian|mandatory|requirement|deadline|legal/i,
    deadline: /deadline|due|before|by \d{4}|march|april/i,
  };

  // Standard compliance frameworks and their requirements
  private readonly complianceFrameworks = {
    SECR: {
      name: 'Streamlined Energy and Carbon Reporting',
      applicableTo: ['listed-company', 'large-unquoted', 'llp'],
      requirements: [
        'Annual energy use reporting',
        'Greenhouse gas emissions disclosure',
        'Energy efficiency measures',
        'Previous year comparison',
      ],
      deadlines: ['Companies House filing deadline'],
    },
    TCFD: {
      name: 'Task Force on Climate-related Financial Disclosures',
      applicableTo: ['listed-company'],
      requirements: [
        'Climate governance disclosure',
        'Climate strategy assessment',
        'Climate risk management',
        'Metrics and targets reporting',
      ],
      deadlines: ['Annual report publication'],
    },
    CSRD: {
      name: 'Corporate Sustainability Reporting Directive',
      applicableTo: ['listed-company', 'large-unquoted'],
      requirements: [
        'Double materiality assessment',
        'Sustainability reporting standards',
        'Third-party assurance',
        'Digital taxonomy tagging',
      ],
      deadlines: ['January 1, 2025 for large companies'],
    },
  };

  constructor() {
    this.documentationService = new UKGovernmentDocumentationService();
  }

  /**
   * Answer user questions using UK government documentation
   */
  async askQuestion(query: AIAgentQuery): Promise<AIAgentResponse> {
    const startTime = Date.now();
    this.logger.log(`Processing AI agent query: ${query.question}`);

    try {
      // Analyze question to determine intent and relevant documents
      const questionIntent = this.analyzeQuestionIntent(query.question);
      
      // Search relevant documentation
      const relevantDocs = await this.findRelevantDocuments(query.question, questionIntent);
      
      // Generate intelligent response
      const answer = await this.generateIntelligentResponse(query, relevantDocs, questionIntent);
      
      // Provide actionable recommendations
      const recommendations = this.generateRecommendations(query, relevantDocs, questionIntent);
      
      // Suggest next steps
      const nextSteps = this.generateNextSteps(query, questionIntent);
      
      // Generate related questions
      const relatedQuestions = this.generateRelatedQuestions(query, questionIntent);

      return {
        answer,
        confidence: this.calculateConfidence(relevantDocs, questionIntent),
        sources: relevantDocs.map(doc => ({
          documentId: doc.id,
          title: doc.title,
          url: doc.url,
          relevantSection: this.extractRelevantSection(doc.content, query.question),
          complianceFramework: doc.processedContent.complianceFramework || 'UK Government',
        })),
        recommendations,
        nextSteps,
        relatedQuestions,
        metadata: {
          processingTime: Date.now() - startTime,
          documentsSearched: relevantDocs.length,
          regulatoryUpdates: await this.getRecentRegulatoryUpdates(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to process AI agent query: ${error.message}`);
      
      return {
        answer: 'I apologize, but I encountered an error while processing your question. Please try rephrasing your question or contact support for assistance.',
        confidence: 0,
        sources: [],
        recommendations: ['Contact technical support for assistance'],
        nextSteps: ['Please try a different question or rephrase your current one'],
        relatedQuestions: [],
        metadata: {
          processingTime: Date.now() - startTime,
          documentsSearched: 0,
        },
      };
    }
  }

  /**
   * Perform comprehensive compliance gap analysis
   */
  async performGapAnalysis(organizationContext: {
    type: 'listed-company' | 'large-unquoted' | 'llp' | 'sme';
    industry: string;
    currentReporting: string[];
    targetFrameworks: string[];
    reportingPeriod: string;
  }): Promise<ComplianceGapAnalysis> {
    this.logger.log(`Performing compliance gap analysis for ${organizationContext.type} in ${organizationContext.industry}`);

    try {
      // Get relevant compliance requirements
      const applicableFrameworks = this.getApplicableFrameworks(organizationContext.type);
      
      // Analyze current vs. required compliance
      const gaps = await this.identifyComplianceGaps(organizationContext, applicableFrameworks);
      
      // Calculate overall compliance score
      const overallCompliance = this.calculateComplianceScore(gaps);
      
      // Generate prioritized recommendations
      const recommendations = this.generateComplianceRecommendations(gaps, organizationContext);
      
      // Get regulatory context
      const regulatoryContext = await this.getRegulatoryContext(applicableFrameworks);

      return {
        overallCompliance,
        gaps,
        recommendations,
        regulatoryContext,
      };
    } catch (error) {
      this.logger.error(`Failed to perform gap analysis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze question to determine intent and category
   */
  private analyzeQuestionIntent(question: string): {
    primary: string;
    secondary: string[];
    urgency: 'high' | 'medium' | 'low';
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const questionLower = question.toLowerCase();
    
    let primary = 'general';
    const secondary: string[] = [];
    let urgency: 'high' | 'medium' | 'low' = 'medium';
    let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';

    // Determine primary intent
    for (const [category, pattern] of Object.entries(this.knowledgePatterns)) {
      if (pattern.test(questionLower)) {
        if (primary === 'general') primary = category;
        else secondary.push(category);
      }
    }

    // Assess urgency
    if (/urgent|asap|immediately|deadline|due|legal/i.test(questionLower)) {
      urgency = 'high';
    } else if (/soon|next week|planning/i.test(questionLower)) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }

    // Assess complexity
    if (/how to|what is|when/i.test(questionLower)) {
      complexity = 'simple';
    } else if (/compare|analyze|calculate|implement/i.test(questionLower)) {
      complexity = 'complex';
    }

    return { primary, secondary, urgency, complexity };
  }

  /**
   * Find relevant documentation based on question
   */
  private async findRelevantDocuments(question: string, intent: any) {
    // Search by category relevance
    const categoryMappings = {
      emissions: ['emissions-reporting', 'conversion-factors'],
      reporting: ['emissions-reporting', 'regulations'],
      calculation: ['conversion-factors', 'calculator'],
      trading: ['carbon-trading'],
      compliance: ['regulations', 'emissions-reporting'],
    };

    const categories = categoryMappings[intent.primary] || [];
    const allDocs = [];

    for (const category of categories) {
      const docs = await this.documentationService.searchDocuments(question, category);
      allDocs.push(...docs);
    }

    // Also search without category restriction for broader results
    const generalDocs = await this.documentationService.searchDocuments(question);
    allDocs.push(...generalDocs);

    // Remove duplicates and rank by relevance
    const uniqueDocs = this.removeDuplicateDocuments(allDocs);
    return this.rankDocumentsByRelevance(uniqueDocs, question);
  }

  /**
   * Generate intelligent response based on documentation
   */
  private async generateIntelligentResponse(
    query: AIAgentQuery,
    relevantDocs: any[],
    intent: any,
  ): Promise<string> {
    if (relevantDocs.length === 0) {
      return 'I couldn\'t find specific UK government guidance for your question. However, I recommend consulting the latest SECR guidance or contacting BEIS directly for clarification.';
    }

    let response = '';
    
    // Start with direct answer based on most relevant document
    const primaryDoc = relevantDocs[0];
    const relevantContent = this.extractRelevantSection(primaryDoc.content, query.question);
    
    // Generate response based on question type and style preference
    switch (query.preferredResponseStyle) {
      case 'concise':
        response = this.generateConciseResponse(relevantContent, intent);
        break;
      case 'technical':
        response = this.generateTechnicalResponse(relevantDocs, intent);
        break;
      case 'executive':
        response = this.generateExecutiveResponse(relevantContent, intent);
        break;
      default:
        response = this.generateDetailedResponse(relevantContent, relevantDocs, intent);
    }

    // Add context-specific information
    if (query.context?.organizationType) {
      response += this.addOrganizationSpecificGuidance(query.context.organizationType, intent);
    }

    return response;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(query: AIAgentQuery, relevantDocs: any[], intent: any): string[] {
    const recommendations: string[] = [];

    // Add framework-specific recommendations
    relevantDocs.forEach(doc => {
      if (doc.processedContent.requirements.length > 0) {
        recommendations.push(...doc.processedContent.requirements.slice(0, 2));
      }
    });

    // Add intent-specific recommendations
    switch (intent.primary) {
      case 'emissions':
        recommendations.push(
          'Implement robust data collection systems for Scope 1, 2, and 3 emissions',
          'Use official DEFRA conversion factors for calculations',
          'Set up regular monitoring and verification processes'
        );
        break;
      case 'reporting':
        recommendations.push(
          'Ensure compliance with SECR requirements if applicable',
          'Consider TCFD-aligned reporting for better investor communication',
          'Implement third-party assurance for credibility'
        );
        break;
      case 'trading':
        recommendations.push(
          'Focus on high-integrity carbon credits with CCP labelling',
          'Ensure transparency in carbon credit usage and claims',
          'Integrate carbon credits into broader net-zero transition plan'
        );
        break;
    }

    return [...new Set(recommendations)].slice(0, 5);
  }

  /**
   * Generate next steps based on question and intent
   */
  private generateNextSteps(query: AIAgentQuery, intent: any): string[] {
    const steps: string[] = [];

    if (intent.urgency === 'high') {
      steps.push('Review applicable reporting deadlines immediately');
      steps.push('Consult with legal/compliance team');
    }

    switch (intent.primary) {
      case 'emissions':
        steps.push(
          'Conduct emissions inventory using latest conversion factors',
          'Identify data gaps and improvement opportunities',
          'Set science-based targets aligned with 1.5°C pathway'
        );
        break;
      case 'reporting':
        steps.push(
          'Map current reporting against applicable requirements',
          'Identify additional disclosures needed',
          'Plan reporting timeline and resource allocation'
        );
        break;
      case 'compliance':
        steps.push(
          'Perform comprehensive compliance gap analysis',
          'Develop remediation plan with timelines',
          'Implement monitoring and review processes'
        );
        break;
    }

    return steps.slice(0, 4);
  }

  /**
   * Generate related questions to help users explore further
   */
  private generateRelatedQuestions(query: AIAgentQuery, intent: any): string[] {
    const related: string[] = [];

    switch (intent.primary) {
      case 'emissions':
        related.push(
          'What are the latest DEFRA conversion factors for my industry?',
          'How do I report Scope 3 emissions under SECR?',
          'What verification is required for emissions reporting?'
        );
        break;
      case 'reporting':
        related.push(
          'What are the key differences between SECR and TCFD reporting?',
          'When do CSRD requirements apply to my organization?',
          'What assurance is required for sustainability reporting?'
        );
        break;
      case 'trading':
        related.push(
          'How do I ensure carbon credits meet high integrity standards?',
          'What disclosure is required when using carbon credits?',
          'How do carbon credits fit into net-zero transition planning?'
        );
        break;
    }

    return related;
  }

  // Helper methods for response generation and analysis
  private generateConciseResponse(content: string, intent: any): string {
    const sentences = content.split('.').filter(s => s.length > 20);
    return sentences.slice(0, 2).join('.') + '.';
  }

  private generateTechnicalResponse(docs: any[], intent: any): string {
    let response = 'Based on UK government technical guidance:\n\n';
    
    docs.slice(0, 2).forEach(doc => {
      if (doc.processedContent.calculationMethods.length > 0) {
        response += `• ${doc.processedContent.calculationMethods[0]}\n`;
      }
    });

    return response;
  }

  private generateExecutiveResponse(content: string, intent: any): string {
    return `Executive Summary: ${this.extractSummary(content)} Key actions required include compliance verification and strategic planning alignment.`;
  }

  private generateDetailedResponse(content: string, docs: any[], intent: any): string {
    let response = `According to UK government guidance:\n\n${this.extractSummary(content)}\n\n`;
    
    if (docs[0].processedContent.keyPoints.length > 0) {
      response += `Key requirements:\n`;
      docs[0].processedContent.keyPoints.slice(0, 3).forEach(point => {
        response += `• ${point}\n`;
      });
    }

    return response;
  }

  private addOrganizationSpecificGuidance(orgType: string, intent: any): string {
    const guidance = {
      'listed-company': '\n\nAs a listed company, you must comply with SECR and consider TCFD-aligned reporting.',
      'large-unquoted': '\n\nAs a large unquoted company, SECR requirements apply to your organization.',
      'llp': '\n\nAs an LLP, you may have SECR obligations depending on your size.',
      'sme': '\n\nWhile not subject to mandatory reporting, voluntary disclosure can enhance reputation.',
    };

    return guidance[orgType] || '';
  }

  private extractRelevantSection(content: string, question: string): string {
    const questionWords = question.toLowerCase().split(' ');
    const sentences = content.split('.');
    
    const relevantSentences = sentences.filter(sentence => {
      const sentenceLower = sentence.toLowerCase();
      return questionWords.some(word => word.length > 3 && sentenceLower.includes(word));
    });

    return relevantSentences.slice(0, 3).join('.') + '.';
  }

  private extractSummary(content: string): string {
    const sentences = content.split('.').filter(s => s.length > 30);
    return sentences.slice(0, 2).join('.') + '.';
  }

  private removeDuplicateDocuments(docs: any[]): any[] {
    const seen = new Set();
    return docs.filter(doc => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  }

  private rankDocumentsByRelevance(docs: any[], question: string): any[] {
    return docs.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, question);
      const scoreB = this.calculateRelevanceScore(b, question);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(doc: any, question: string): number {
    let score = 0;
    const questionLower = question.toLowerCase();
    const contentLower = doc.content.toLowerCase();
    
    // Count keyword matches
    const questionWords = questionLower.split(' ');
    questionWords.forEach(word => {
      if (word.length > 3 && contentLower.includes(word)) {
        score += 1;
      }
    });

    // Boost score for key document types
    if (doc.type === 'regulation') score += 5;
    if (doc.type === 'guidance') score += 3;
    if (doc.type === 'reporting-guidelines') score += 4;

    return score;
  }

  private calculateConfidence(docs: any[], intent: any): number {
    if (docs.length === 0) return 0.1;
    if (docs.length === 1) return 0.6;
    if (docs.length >= 2 && intent.primary !== 'general') return 0.9;
    return 0.7;
  }

  private async getRecentRegulatoryUpdates(): Promise<string[]> {
    const summary = await this.documentationService.getDocumentationSummary();
    return summary.latestUpdates.slice(0, 3);
  }

  // Compliance gap analysis methods
  private getApplicableFrameworks(orgType: string): string[] {
    const frameworks: string[] = [];
    
    Object.entries(this.complianceFrameworks).forEach(([key, framework]) => {
      if (framework.applicableTo.includes(orgType)) {
        frameworks.push(key);
      }
    });

    return frameworks;
  }

  private async identifyComplianceGaps(orgContext: any, frameworks: string[]): Promise<ComplianceGapAnalysis['gaps']> {
    const gaps: ComplianceGapAnalysis['gaps'] = [];

    for (const framework of frameworks) {
      const frameworkDef = this.complianceFrameworks[framework];
      
      frameworkDef.requirements.forEach(requirement => {
        if (!orgContext.currentReporting.includes(requirement)) {
          gaps.push({
            category: framework,
            severity: this.assessGapSeverity(requirement, framework),
            description: `Missing: ${requirement}`,
            requirement,
            deadline: frameworkDef.deadlines[0],
            remediation: this.getRemediationAdvice(requirement),
            estimatedEffort: this.estimateImplementationEffort(requirement),
          });
        }
      });
    }

    return gaps;
  }

  private calculateComplianceScore(gaps: ComplianceGapAnalysis['gaps']): number {
    if (gaps.length === 0) return 100;

    const severityWeights = { critical: 25, high: 15, medium: 10, low: 5 };
    const totalPossibleScore = 100;
    const deductions = gaps.reduce((sum, gap) => sum + severityWeights[gap.severity], 0);
    
    return Math.max(0, totalPossibleScore - deductions);
  }

  private generateComplianceRecommendations(gaps: any[], orgContext: any): ComplianceGapAnalysis['recommendations'] {
    const recommendations: ComplianceGapAnalysis['recommendations'] = [];

    // Critical gaps first
    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    criticalGaps.forEach(gap => {
      recommendations.push({
        priority: 'immediate',
        action: `Address ${gap.description}`,
        benefit: 'Avoid regulatory non-compliance',
        resources: ['Legal counsel', 'Compliance specialist'],
      });
    });

    // Strategic recommendations
    if (gaps.some(g => g.category === 'TCFD')) {
      recommendations.push({
        priority: 'high',
        action: 'Implement TCFD-aligned climate disclosures',
        benefit: 'Enhanced investor confidence and risk management',
        resources: ['Climate risk consultant', 'Sustainability team'],
      });
    }

    return recommendations.slice(0, 5);
  }

  private async getRegulatoryContext(frameworks: string[]): Promise<ComplianceGapAnalysis['regulatoryContext']> {
    const context: ComplianceGapAnalysis['regulatoryContext'] = [];

    for (const framework of frameworks) {
      context.push({
        framework,
        lastUpdated: new Date().toISOString(),
        upcomingChanges: ['CSRD implementation phases', 'UK Green Taxonomy development'],
      });
    }

    return context;
  }

  private assessGapSeverity(requirement: string, framework: string): 'critical' | 'high' | 'medium' | 'low' {
    if (requirement.includes('mandatory') || framework === 'SECR') return 'critical';
    if (requirement.includes('disclosure') || requirement.includes('reporting')) return 'high';
    if (requirement.includes('assessment') || requirement.includes('strategy')) return 'medium';
    return 'low';
  }

  private getRemediationAdvice(requirement: string): string {
    if (requirement.includes('energy')) return 'Implement energy monitoring systems and data collection processes';
    if (requirement.includes('emissions')) return 'Establish GHG inventory and calculation procedures';
    if (requirement.includes('governance')) return 'Define climate governance structure and responsibilities';
    return 'Consult with compliance experts for specific implementation guidance';
  }

  private estimateImplementationEffort(requirement: string): string {
    if (requirement.includes('system') || requirement.includes('governance')) return '3-6 months';
    if (requirement.includes('reporting') || requirement.includes('disclosure')) return '2-4 months';
    if (requirement.includes('assessment') || requirement.includes('measure')) return '1-3 months';
    return '1-2 months';
  }
}