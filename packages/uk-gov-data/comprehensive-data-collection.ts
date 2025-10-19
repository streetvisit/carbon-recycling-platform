#!/usr/bin/env node

import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UKGovernmentDocumentationService } from './documentation-service';
import { DEFRAConversionFactorsCollector } from './defra-conversion-factors-collector';
import { UKGovernmentAIAgent } from './ai-agent';
import { EnhancedGapAnalysisEngine } from './enhanced-gap-analysis';

interface ComprehensiveDataCollectionResult {
  success: boolean;
  timestamp: string;
  duration: number;
  ukGovernmentDocs: {
    success: boolean;
    totalDocuments: number;
    failedDocuments: number;
    error?: string;
  };
  defraConversionFactors: {
    success: boolean;
    totalFactors: number;
    totalDocuments: number;
    yearsCovered: number[];
    error?: string;
  };
  aiAgentTesting: {
    success: boolean;
    testResults: any[];
    error?: string;
  };
  gapAnalysisTesting: {
    success: boolean;
    testResults: any[];
    error?: string;
  };
  validation: {
    dataIntegrity: boolean;
    aiResponseQuality: boolean;
    complianceAccuracy: boolean;
    issues: string[];
  };
}

export class ComprehensiveDataCollectionRunner {
  private readonly logger = new Logger(ComprehensiveDataCollectionRunner.name);
  private readonly outputPath = path.join(process.cwd(), 'data', 'collection-results');
  
  private documentationService: UKGovernmentDocumentationService;
  private defraCollector: DEFRAConversionFactorsCollector;
  private aiAgent: UKGovernmentAIAgent;
  private gapAnalysisEngine: EnhancedGapAnalysisEngine;

  constructor() {
    this.ensureDirectoriesExist();
    this.initializeServices();
  }

  /**
   * Run comprehensive data collection, processing, and validation
   */
  async runComprehensiveCollection(): Promise<ComprehensiveDataCollectionResult> {
    const startTime = Date.now();
    this.logger.log('🚀 Starting comprehensive UK government data collection and validation');

    const result: ComprehensiveDataCollectionResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: 0,
      ukGovernmentDocs: { success: false, totalDocuments: 0, failedDocuments: 0 },
      defraConversionFactors: { success: false, totalFactors: 0, totalDocuments: 0, yearsCovered: [] },
      aiAgentTesting: { success: false, testResults: [] },
      gapAnalysisTesting: { success: false, testResults: [] },
      validation: { dataIntegrity: false, aiResponseQuality: false, complianceAccuracy: false, issues: [] },
    };

    try {
      // Step 1: Collect UK Government Documents
      this.logger.log('📄 Step 1: Collecting UK Government Documents...');
      const govDocsResult = await this.collectGovernmentDocuments();
      result.ukGovernmentDocs = govDocsResult;

      if (!govDocsResult.success) {
        this.logger.error('❌ Government documents collection failed, continuing with DEFRA data...');
      }

      // Step 2: Collect DEFRA Conversion Factors
      this.logger.log('📊 Step 2: Collecting comprehensive DEFRA conversion factors...');
      const defraResult = await this.collectDEFRAConversionFactors();
      result.defraConversionFactors = defraResult;

      if (!defraResult.success) {
        this.logger.error('❌ DEFRA conversion factors collection failed');
      }

      // Step 3: Test AI Agent with collected data
      this.logger.log('🤖 Step 3: Testing AI Agent with collected data...');
      const aiTestResult = await this.testAIAgent();
      result.aiAgentTesting = aiTestResult;

      // Step 4: Test Gap Analysis Engine
      this.logger.log('📈 Step 4: Testing Enhanced Gap Analysis Engine...');
      const gapAnalysisResult = await this.testGapAnalysisEngine();
      result.gapAnalysisTesting = gapAnalysisResult;

      // Step 5: Validate data integrity and AI quality
      this.logger.log('✅ Step 5: Validating data integrity and AI quality...');
      const validationResult = await this.validateCollectedData(result);
      result.validation = validationResult;

      // Determine overall success
      result.success = (
        (govDocsResult.success || defraResult.success) &&
        aiTestResult.success &&
        gapAnalysisResult.success &&
        validationResult.dataIntegrity
      );

      result.duration = Date.now() - startTime;

      // Save comprehensive results
      await this.saveResults(result);

      if (result.success) {
        this.logger.log(`🎉 Comprehensive data collection completed successfully in ${result.duration}ms`);
        this.logSuccessSummary(result);
      } else {
        this.logger.error(`❌ Comprehensive data collection completed with issues in ${result.duration}ms`);
        this.logErrorSummary(result);
      }

      return result;

    } catch (error) {
      this.logger.error(`❌ Comprehensive data collection failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      result.validation.issues.push(`Critical error: ${error.message}`);
      
      await this.saveResults(result);
      return result;
    }
  }

  /**
   * Collect UK Government documents
   */
  private async collectGovernmentDocuments(): Promise<{
    success: boolean;
    totalDocuments: number;
    failedDocuments: number;
    error?: string;
  }> {
    try {
      const results = await this.documentationService.downloadAllDocumentation();
      
      const successfulDocs = results.filter(r => r.success).length;
      const failedDocs = results.filter(r => !r.success).length;
      
      return {
        success: successfulDocs > 0,
        totalDocuments: successfulDocs,
        failedDocuments: failedDocs,
      };
    } catch (error) {
      return {
        success: false,
        totalDocuments: 0,
        failedDocuments: 0,
        error: error.message,
      };
    }
  }

  /**
   * Collect DEFRA conversion factors comprehensively
   */
  private async collectDEFRAConversionFactors(): Promise<{
    success: boolean;
    totalFactors: number;
    totalDocuments: number;
    yearsCovered: number[];
    error?: string;
  }> {
    try {
      const database = await this.defraCollector.collectAllConversionFactors();
      
      return {
        success: true,
        totalFactors: database.totalFactors,
        totalDocuments: database.totalDocuments,
        yearsCovered: database.yearsCovered,
      };
    } catch (error) {
      return {
        success: false,
        totalFactors: 0,
        totalDocuments: 0,
        yearsCovered: [],
        error: error.message,
      };
    }
  }

  /**
   * Test AI Agent functionality
   */
  private async testAIAgent(): Promise<{
    success: boolean;
    testResults: any[];
    error?: string;
  }> {
    try {
      const testQueries = [
        {
          query: "What are the mandatory greenhouse gas reporting requirements for UK companies?",
          expectedTopics: ["SECR", "mandatory", "reporting", "greenhouse gas"],
        },
        {
          query: "How do I calculate Scope 2 emissions for electricity consumption?",
          expectedTopics: ["Scope 2", "electricity", "conversion factors", "calculate"],
        },
        {
          query: "What conversion factors should I use for natural gas combustion?",
          expectedTopics: ["natural gas", "conversion factors", "combustion", "DEFRA"],
        },
        {
          query: "What are the compliance deadlines for carbon emissions reporting?",
          expectedTopics: ["deadlines", "compliance", "reporting", "carbon"],
        },
        {
          query: "Perform a gap analysis for our manufacturing company's carbon reporting",
          expectedTopics: ["gap analysis", "manufacturing", "carbon reporting", "recommendations"],
        },
      ];

      const testResults = [];

      for (const test of testQueries) {
        try {
          this.logger.log(`🧪 Testing query: ${test.query.substring(0, 50)}...`);
          
          const response = await this.aiAgent.answerComplianceQuestion(test.query);
          
          const containsExpectedTopics = test.expectedTopics.some(topic =>
            response.answer.toLowerCase().includes(topic.toLowerCase()) ||
            response.sources.some(source => source.toLowerCase().includes(topic.toLowerCase()))
          );

          testResults.push({
            query: test.query,
            success: containsExpectedTopics && response.answer.length > 100,
            responseLength: response.answer.length,
            sourcesCount: response.sources.length,
            containsExpectedTopics,
            expectedTopics: test.expectedTopics,
          });
        } catch (error) {
          testResults.push({
            query: test.query,
            success: false,
            error: error.message,
          });
        }
      }

      const successfulTests = testResults.filter(r => r.success).length;
      
      return {
        success: successfulTests >= testQueries.length * 0.8, // 80% success rate required
        testResults,
      };
    } catch (error) {
      return {
        success: false,
        testResults: [],
        error: error.message,
      };
    }
  }

  /**
   * Test Gap Analysis Engine functionality
   */
  private async testGapAnalysisEngine(): Promise<{
    success: boolean;
    testResults: any[];
    error?: string;
  }> {
    try {
      // Sample company data for testing
      const sampleCompanyData = {
        companyId: 'test-company-001',
        companyName: 'Test Manufacturing Ltd',
        sector: 'Manufacturing',
        employees: 250,
        revenue: 50000000,
        currentReporting: {
          scope1: { reported: true, methodologies: ['DEFRA'] },
          scope2: { reported: true, methodologies: ['Market-based'] },
          scope3: { reported: false, methodologies: [] },
        },
        facilities: [
          { location: 'UK', type: 'Manufacturing', energyIntensive: true },
        ],
      };

      const testResults = [];

      try {
        this.logger.log('🧪 Testing gap analysis for sample manufacturing company...');
        
        const gapAnalysis = await this.gapAnalysisEngine.performAIEnhancedGapAnalysis(
          sampleCompanyData,
          'comprehensive'
        );

        testResults.push({
          testType: 'comprehensive_gap_analysis',
          success: !!(
            gapAnalysis.overallScore &&
            gapAnalysis.aiInsights &&
            gapAnalysis.governmentGuidance &&
            gapAnalysis.actionPlan &&
            gapAnalysis.actionPlan.length > 0
          ),
          gapCount: gapAnalysis.identifiedGaps?.length || 0,
          recommendationCount: gapAnalysis.actionPlan?.length || 0,
          aiInsightsQuality: gapAnalysis.aiInsights?.length > 100,
          governmentGuidancePresent: !!gapAnalysis.governmentGuidance,
        });
      } catch (error) {
        testResults.push({
          testType: 'comprehensive_gap_analysis',
          success: false,
          error: error.message,
        });
      }

      const successfulTests = testResults.filter(r => r.success).length;

      return {
        success: successfulTests === testResults.length,
        testResults,
      };
    } catch (error) {
      return {
        success: false,
        testResults: [],
        error: error.message,
      };
    }
  }

  /**
   * Validate collected data and AI quality
   */
  private async validateCollectedData(result: ComprehensiveDataCollectionResult): Promise<{
    dataIntegrity: boolean;
    aiResponseQuality: boolean;
    complianceAccuracy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let dataIntegrity = true;
    let aiResponseQuality = true;
    let complianceAccuracy = true;

    // Validate data integrity
    if (result.ukGovernmentDocs.totalDocuments === 0 && result.defraConversionFactors.totalFactors === 0) {
      dataIntegrity = false;
      issues.push('No data collected from either UK Government docs or DEFRA conversion factors');
    }

    if (result.defraConversionFactors.success && result.defraConversionFactors.yearsCovered.length === 0) {
      dataIntegrity = false;
      issues.push('DEFRA data collected but no years covered');
    }

    // Validate AI response quality
    if (result.aiAgentTesting.success) {
      const lowQualityResponses = result.aiAgentTesting.testResults.filter(
        r => r.success && r.responseLength < 100
      ).length;
      
      if (lowQualityResponses > result.aiAgentTesting.testResults.length * 0.3) {
        aiResponseQuality = false;
        issues.push('More than 30% of AI responses are too short (< 100 characters)');
      }
    } else {
      aiResponseQuality = false;
      issues.push('AI agent testing failed');
    }

    // Validate compliance accuracy
    if (!result.gapAnalysisTesting.success) {
      complianceAccuracy = false;
      issues.push('Gap analysis engine testing failed');
    }

    // Check for data consistency
    try {
      const summary = await this.documentationService.getComprehensiveSummary();
      if (summary.defraData && summary.defraData.totalFactors !== result.defraConversionFactors.totalFactors) {
        issues.push('DEFRA data inconsistency detected between collection and summary');
      }
    } catch (error) {
      issues.push(`Failed to validate data consistency: ${error.message}`);
    }

    return {
      dataIntegrity,
      aiResponseQuality,
      complianceAccuracy,
      issues,
    };
  }

  /**
   * Save comprehensive results
   */
  private async saveResults(result: ComprehensiveDataCollectionResult): Promise<void> {
    const resultsFile = path.join(this.outputPath, `collection-results-${Date.now()}.json`);
    const latestFile = path.join(this.outputPath, 'latest-collection-results.json');

    try {
      await fs.promises.writeFile(resultsFile, JSON.stringify(result, null, 2), 'utf8');
      await fs.promises.writeFile(latestFile, JSON.stringify(result, null, 2), 'utf8');
      
      this.logger.log(`💾 Results saved to ${resultsFile}`);
    } catch (error) {
      this.logger.error(`❌ Failed to save results: ${error.message}`);
    }
  }

  /**
   * Log success summary
   */
  private logSuccessSummary(result: ComprehensiveDataCollectionResult): void {
    this.logger.log('🎉 SUCCESS SUMMARY:');
    this.logger.log(`   📄 UK Gov Documents: ${result.ukGovernmentDocs.totalDocuments} collected`);
    this.logger.log(`   📊 DEFRA Factors: ${result.defraConversionFactors.totalFactors} factors from ${result.defraConversionFactors.totalDocuments} docs`);
    this.logger.log(`   🤖 AI Agent: ${result.aiAgentTesting.testResults.filter(r => r.success).length}/${result.aiAgentTesting.testResults.length} tests passed`);
    this.logger.log(`   📈 Gap Analysis: ${result.gapAnalysisTesting.testResults.filter(r => r.success).length}/${result.gapAnalysisTesting.testResults.length} tests passed`);
    this.logger.log(`   ⏱️  Total Duration: ${result.duration}ms`);
    
    if (result.defraConversionFactors.yearsCovered.length > 0) {
      const years = result.defraConversionFactors.yearsCovered;
      this.logger.log(`   📅 DEFRA Years Covered: ${Math.min(...years)}-${Math.max(...years)} (${years.length} years)`);
    }
  }

  /**
   * Log error summary
   */
  private logErrorSummary(result: ComprehensiveDataCollectionResult): void {
    this.logger.error('❌ ERROR SUMMARY:');
    
    if (!result.ukGovernmentDocs.success) {
      this.logger.error(`   📄 UK Gov Documents: FAILED - ${result.ukGovernmentDocs.error || 'Unknown error'}`);
    }
    
    if (!result.defraConversionFactors.success) {
      this.logger.error(`   📊 DEFRA Factors: FAILED - ${result.defraConversionFactors.error || 'Unknown error'}`);
    }
    
    if (!result.aiAgentTesting.success) {
      this.logger.error(`   🤖 AI Agent: FAILED - ${result.aiAgentTesting.error || 'Tests failed'}`);
    }
    
    if (!result.gapAnalysisTesting.success) {
      this.logger.error(`   📈 Gap Analysis: FAILED - ${result.gapAnalysisTesting.error || 'Tests failed'}`);
    }
    
    if (result.validation.issues.length > 0) {
      this.logger.error('   ⚠️  Validation Issues:');
      result.validation.issues.forEach(issue => {
        this.logger.error(`      - ${issue}`);
      });
    }
  }

  /**
   * Initialize services
   */
  private initializeServices(): void {
    this.documentationService = new UKGovernmentDocumentationService();
    this.defraCollector = new DEFRAConversionFactorsCollector();
    this.aiAgent = new UKGovernmentAIAgent();
    this.gapAnalysisEngine = new EnhancedGapAnalysisEngine();
  }

  /**
   * Ensure directories exist
   */
  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }
}

// CLI runner
async function main() {
  const runner = new ComprehensiveDataCollectionRunner();
  
  try {
    const result = await runner.runComprehensiveCollection();
    
    if (result.success) {
      console.log('\n🎉 Comprehensive data collection completed successfully!');
      console.log(`📊 Total DEFRA conversion factors collected: ${result.defraConversionFactors.totalFactors}`);
      console.log(`📄 Total UK government documents processed: ${result.ukGovernmentDocs.totalDocuments}`);
      console.log(`⏱️  Total duration: ${(result.duration / 1000).toFixed(2)} seconds`);
      process.exit(0);
    } else {
      console.error('\n❌ Comprehensive data collection completed with issues');
      console.error('Check logs for details');
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n💥 Critical error: ${error.message}`);
    process.exit(1);
  }
}

// Export for programmatic use
export { ComprehensiveDataCollectionRunner };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}