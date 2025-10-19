import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdf from 'pdf-parse';
import { DEFRAConversionFactorsCollector } from './defra-conversion-factors-collector';

interface GovernmentDocument {
  id: string;
  title: string;
  url: string;
  type: 'guidance' | 'regulation' | 'calculator' | 'conversion-factors' | 'reporting-guidelines' | 'news';
  category: 'emissions-reporting' | 'carbon-trading' | 'conversion-factors' | 'calculator' | 'regulations';
  lastUpdated: string;
  content: string;
  metadata: {
    department: string;
    fileFormat: 'html' | 'pdf' | 'excel';
    documentSize?: number;
    pageCount?: number;
    publishedDate?: string;
    version?: string;
  };
  processedContent: {
    summary: string;
    keyPoints: string[];
    requirements: string[];
    calculationMethods: string[];
    conversionFactors?: Record<string, number>;
    deadlines?: string[];
    complianceFramework?: string;
  };
}

interface DocumentProcessingResult {
  success: boolean;
  document?: GovernmentDocument;
  error?: string;
  processingTime: number;
}

export class UKGovernmentDocumentationService {
  private readonly logger = new Logger(UKGovernmentDocumentationService.name);
  private readonly baseDataPath = path.join(process.cwd(), 'data', 'uk-government');
  private readonly cachePath = path.join(this.baseDataPath, 'cache');
  private readonly documentsPath = path.join(this.baseDataPath, 'documents');
  
  private readonly defraCollector: DEFRAConversionFactorsCollector;
  
  // Official UK Government URLs for carbon and emissions guidance
  private readonly governmentSources = [
    {
      id: 'carbon-credits-trading',
      title: 'UK backs businesses to trade carbon credits and unlock finance',
      url: 'https://www.gov.uk/government/news/uk-backs-businesses-to-trade-carbon-credits-and-unlock-finance',
      type: 'news' as const,
      category: 'carbon-trading' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'greenhouse-gas-emissions-main',
      title: 'Greenhouse Gas Emissions - Main Page',
      url: 'https://www.gov.uk/environment/greenhouse-gas-emissions',
      type: 'guidance' as const,
      category: 'emissions-reporting' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'greenhouse-gas-guidance-regulation',
      title: 'Greenhouse Gas Emissions - Guidance and Regulation',
      url: 'https://www.gov.uk/environment/greenhouse-gas-emissions#guidance_and_regulation',
      type: 'regulation' as const,
      category: 'regulations' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'carbon-calculator',
      title: 'MacKay Carbon Calculator Guidance',
      url: 'https://www.gov.uk/guidance/carbon-calculator',
      type: 'calculator' as const,
      category: 'calculator' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'environmental-reporting-guidelines',
      title: 'Environmental reporting guidelines including mandatory greenhouse gas emissions reporting guidance',
      url: 'https://www.gov.uk/government/publications/environmental-reporting-guidelines-including-mandatory-greenhouse-gas-emissions-reporting-guidance',
      type: 'reporting-guidelines' as const,
      category: 'emissions-reporting' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'government-conversion-factors',
      title: 'Government conversion factors for company reporting',
      url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
      type: 'conversion-factors' as const,
      category: 'conversion-factors' as const,
      department: 'Department for Energy Security and Net Zero',
    },
    {
      id: 'emissions-research-statistics',
      title: 'Greenhouse Gas Emissions Research and Statistics',
      url: 'https://www.gov.uk/search/research-and-statistics?parent=%2Fenvironment%2Fgreenhouse-gas-emissions&topic=2b15ade6-cfcb-4088-bcde-0ab4e29c26ac',
      type: 'guidance' as const,
      category: 'emissions-reporting' as const,
      department: 'Department for Energy Security and Net Zero',
    }
  ];

  constructor() {
    this.ensureDirectoriesExist();
    this.defraCollector = new DEFRAConversionFactorsCollector();
  }

  /**
   * Download and process all UK government documentation including DEFRA conversion factors
   */
  async downloadAllDocumentation(): Promise<DocumentProcessingResult[]> {
    this.logger.log('Starting comprehensive UK government documentation download');

    // Step 1: Collect comprehensive DEFRA conversion factors
    this.logger.log('📊 Collecting comprehensive DEFRA conversion factors...');
    const defraDatabase = await this.defraCollector.collectAllConversionFactors();
    this.logger.log(`✅ DEFRA collection complete: ${defraDatabase.totalFactors} factors from ${defraDatabase.totalDocuments} documents`);

    // Step 2: Process other government documents
    const results: DocumentProcessingResult[] = [];

    for (const source of this.governmentSources) {
      try {
        const result = await this.processDocument(source);
        results.push(result);
        
        if (result.success) {
          this.logger.log(`Successfully processed: ${source.title}`);
        } else {
          this.logger.error(`Failed to process: ${source.title} - ${result.error}`);
        }

        // Rate limiting to be respectful to gov.uk servers
        await this.delay(2000);
      } catch (error) {
        this.logger.error(`Error processing ${source.title}: ${error.message}`);
        results.push({
          success: false,
          error: error.message,
          processingTime: 0,
        });
      }
    }

    // Save consolidated documentation index with DEFRA data
    await this.saveDocumentationIndex(results, defraDatabase);

    return results;
  }

  /**
   * Process a single government document
   */
  private async processDocument(source: any): Promise<DocumentProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing document: ${source.title}`);

      // Check cache first
      const cachedDoc = await this.getCachedDocument(source.id);
      if (cachedDoc && this.isCacheValid(cachedDoc)) {
        this.logger.log(`Using cached version of: ${source.title}`);
        return {
          success: true,
          document: cachedDoc,
          processingTime: Date.now() - startTime,
        };
      }

      // Download fresh content
      const response = await axios.get(source.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Carbon-Recycling-Platform-Bot/1.0 (Compliance Documentation)',
        },
      });

      // Extract content based on content type
      let content = '';
      let metadata = {
        department: source.department,
        fileFormat: 'html' as const,
        documentSize: response.data.length,
      };

      if (response.headers['content-type']?.includes('application/pdf')) {
        content = await this.extractPDFContent(response.data);
        metadata.fileFormat = 'pdf';
      } else {
        content = await this.extractHTMLContent(response.data);
        metadata.fileFormat = 'html';
      }

      // Process and analyze content
      const processedContent = await this.analyzeContent(content, source.category);

      const document: GovernmentDocument = {
        id: source.id,
        title: source.title,
        url: source.url,
        type: source.type,
        category: source.category,
        lastUpdated: new Date().toISOString(),
        content,
        metadata,
        processedContent,
      };

      // Cache the document
      await this.cacheDocument(document);

      return {
        success: true,
        document,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Failed to process document ${source.title}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract content from HTML pages
   */
  private async extractHTMLContent(html: string): Promise<string> {
    const $ = cheerio.load(html);

    // Remove navigation, footer, and other non-content elements
    $('nav, .gem-c-skip-link, .gem-c-cookie-banner, footer, .gem-c-feedback').remove();
    
    // Focus on main content areas
    const contentSelectors = [
      '.gem-c-govspeak',
      '.publication-external-links',
      '.gem-c-lead-paragraph',
      '.gem-c-document-list',
      '.govuk-grid-column-two-thirds',
      'main',
    ];

    let content = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        content += element.text().trim() + '\n\n';
      }
    }

    // If no specific content found, get body text
    if (!content.trim()) {
      content = $('body').text().trim();
    }

    // Clean up content
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Extract content from PDF documents
   */
  private async extractPDFContent(pdfBuffer: Buffer): Promise<string> {
    try {
      const data = await pdf(pdfBuffer);
      return data.text;
    } catch (error) {
      this.logger.error(`Failed to extract PDF content: ${error.message}`);
      return '';
    }
  }

  /**
   * Analyze and extract key information from document content
   */
  private async analyzeContent(content: string, category: string): Promise<GovernmentDocument['processedContent']> {
    const summary = this.extractSummary(content);
    const keyPoints = this.extractKeyPoints(content);
    const requirements = this.extractRequirements(content);
    const calculationMethods = this.extractCalculationMethods(content);
    const conversionFactors = category === 'conversion-factors' ? this.extractConversionFactors(content) : undefined;
    const deadlines = this.extractDeadlines(content);
    const complianceFramework = this.determineComplianceFramework(content, category);

    return {
      summary,
      keyPoints,
      requirements,
      calculationMethods,
      conversionFactors,
      deadlines,
      complianceFramework,
    };
  }

  /**
   * Extract document summary
   */
  private extractSummary(content: string): string {
    // Get first paragraph or first few sentences
    const sentences = content.split('.').filter(s => s.length > 50);
    return sentences.slice(0, 3).join('.') + '.';
  }

  /**
   * Extract key points from content
   */
  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    
    // Look for bullet points, numbered lists, or key phrases
    const bulletPattern = /(?:^|\n)[\s]*[\*\-\•]\s*([^\n]+)/g;
    const numberedPattern = /(?:^|\n)[\s]*\d+\.?\s*([^\n]+)/g;
    const keyPhrasePattern = /(must|required|shall|important|key|essential|mandatory)[^\.]+\./gi;

    let match;
    while ((match = bulletPattern.exec(content)) !== null) {
      keyPoints.push(match[1].trim());
    }

    while ((match = numberedPattern.exec(content)) !== null) {
      keyPoints.push(match[1].trim());
    }

    while ((match = keyPhrasePattern.exec(content)) !== null) {
      keyPoints.push(match[0].trim());
    }

    // Remove duplicates and filter for quality
    return [...new Set(keyPoints)]
      .filter(point => point.length > 20 && point.length < 200)
      .slice(0, 10);
  }

  /**
   * Extract compliance requirements
   */
  private extractRequirements(content: string): string[] {
    const requirements: string[] = [];
    
    const requirementPatterns = [
      /companies must[^\.]+\./gi,
      /organisations shall[^\.]+\./gi,
      /requirement to[^\.]+\./gi,
      /mandatory[^\.]+\./gi,
      /comply with[^\.]+\./gi,
    ];

    requirementPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      requirements.push(...matches.map(m => m.trim()));
    });

    return [...new Set(requirements)].slice(0, 15);
  }

  /**
   * Extract calculation methods
   */
  private extractCalculationMethods(content: string): string[] {
    const methods: string[] = [];
    
    const methodPatterns = [
      /calculate[^\.]+\./gi,
      /formula[^\.]+\./gi,
      /method[^\.]+\./gi,
      /conversion factor[^\.]+\./gi,
      /CO2[^\.]+tonnes/gi,
    ];

    methodPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      methods.push(...matches.map(m => m.trim()));
    });

    return [...new Set(methods)].slice(0, 10);
  }

  /**
   * Extract conversion factors for calculations
   */
  private extractConversionFactors(content: string): Record<string, number> {
    const factors: Record<string, number> = {};
    
    // Look for numerical factors in the content
    const factorPattern = /([a-zA-Z\s]+)\s*[\:\-]\s*(\d+\.?\d*)\s*(kg|tonnes?|litres?)/gi;
    
    let match;
    while ((match = factorPattern.exec(content)) !== null) {
      const [, category, value, unit] = match;
      const cleanCategory = category.trim().toLowerCase().replace(/\s+/g, '_');
      factors[cleanCategory] = parseFloat(value);
    }

    return factors;
  }

  /**
   * Extract important deadlines
   */
  private extractDeadlines(content: string): string[] {
    const deadlines: string[] = [];
    
    const datePatterns = [
      /by\s+(\d{1,2}\s+\w+\s+\d{4})/gi,
      /before\s+(\d{1,2}\s+\w+\s+\d{4})/gi,
      /deadline[^\.]*(\d{1,2}\s+\w+\s+\d{4})/gi,
      /april\s+\d{4}/gi,
      /march\s+\d{4}/gi,
    ];

    datePatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      deadlines.push(...matches.map(m => m.trim()));
    });

    return [...new Set(deadlines)];
  }

  /**
   * Determine compliance framework
   */
  private determineComplianceFramework(content: string, category: string): string {
    const frameworks = {
      'SECR': /SECR|Streamlined Energy and Carbon Reporting/i,
      'TCFD': /TCFD|Task Force on Climate-related Financial Disclosures/i,
      'CSRD': /CSRD|Corporate Sustainability Reporting Directive/i,
      'GRI': /GRI|Global Reporting Initiative/i,
      'ISO14064': /ISO\s*14064/i,
    };

    for (const [framework, pattern] of Object.entries(frameworks)) {
      if (pattern.test(content)) {
        return framework;
      }
    }

    // Default based on category
    const categoryMappings = {
      'emissions-reporting': 'SECR',
      'conversion-factors': 'DEFRA',
      'carbon-trading': 'VCMI',
      'calculator': 'MacKay',
      'regulations': 'UK Climate Law',
    };

    return categoryMappings[category] || 'UK Government';
  }

  /**
   * Cache document for future use
   */
  private async cacheDocument(document: GovernmentDocument): Promise<void> {
    const cacheFilePath = path.join(this.cachePath, `${document.id}.json`);
    
    try {
      await fs.promises.writeFile(
        cacheFilePath,
        JSON.stringify(document, null, 2),
        'utf8'
      );
    } catch (error) {
      this.logger.error(`Failed to cache document ${document.id}: ${error.message}`);
    }
  }

  /**
   * Get cached document
   */
  private async getCachedDocument(documentId: string): Promise<GovernmentDocument | null> {
    const cacheFilePath = path.join(this.cachePath, `${documentId}.json`);
    
    try {
      if (await this.fileExists(cacheFilePath)) {
        const cachedData = await fs.promises.readFile(cacheFilePath, 'utf8');
        return JSON.parse(cachedData);
      }
    } catch (error) {
      this.logger.error(`Failed to read cached document ${documentId}: ${error.message}`);
    }

    return null;
  }

  /**
   * Check if cached document is still valid (7 days)
   */
  private isCacheValid(document: GovernmentDocument): boolean {
    const cacheAge = Date.now() - new Date(document.lastUpdated).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    return cacheAge < maxAge;
  }

  /**
   * Save consolidated documentation index with DEFRA data
   */
  private async saveDocumentationIndex(
    results: DocumentProcessingResult[], 
    defraDatabase?: any
  ): Promise<void> {
    const indexPath = path.join(this.baseDataPath, 'documentation-index.json');
    
    const index = {
      lastUpdated: new Date().toISOString(),
      totalDocuments: results.filter(r => r.success).length + (defraDatabase?.totalDocuments || 0),
      failedDocuments: results.filter(r => !r.success).length,
      categories: this.groupDocumentsByCategory(results),
      defraConversionFactors: defraDatabase ? {
        totalFactors: defraDatabase.totalFactors,
        totalDocuments: defraDatabase.totalDocuments,
        yearsCovered: defraDatabase.yearsCovered,
        categories: defraDatabase.categories,
        trendsCount: defraDatabase.trends.length,
        latestYear: Math.max(...defraDatabase.yearsCovered),
        oldestYear: Math.min(...defraDatabase.yearsCovered),
      } : null,
      documents: results.filter(r => r.success).map(r => ({
        id: r.document.id,
        title: r.document.title,
        category: r.document.category,
        type: r.document.type,
        lastUpdated: r.document.lastUpdated,
        keyPoints: r.document.processedContent.keyPoints.length,
        requirements: r.document.processedContent.requirements.length,
        complianceFramework: r.document.processedContent.complianceFramework,
      })),
    };

    try {
      await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
      this.logger.log(`Documentation index saved with ${index.totalDocuments} documents (${index.defraConversionFactors?.totalFactors || 0} DEFRA factors)`);
    } catch (error) {
      this.logger.error(`Failed to save documentation index: ${error.message}`);
    }
  }

  /**
   * Group documents by category for the index
   */
  private groupDocumentsByCategory(results: DocumentProcessingResult[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    results
      .filter(r => r.success)
      .forEach(r => {
        const category = r.document.category;
        categories[category] = (categories[category] || 0) + 1;
      });

    return categories;
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectoriesExist(): void {
    const directories = [this.baseDataPath, this.cachePath, this.documentsPath];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get documentation summary for AI agents
   */
  async getDocumentationSummary(): Promise<{
    totalDocuments: number;
    categories: Record<string, number>;
    latestUpdates: string[];
    keyRequirements: string[];
    complianceFrameworks: string[];
  }> {
    const indexPath = path.join(this.baseDataPath, 'documentation-index.json');
    
    try {
      if (await this.fileExists(indexPath)) {
        const index = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
        
        // Get key requirements from all documents
        const keyRequirements: string[] = [];
        const complianceFrameworks: string[] = [];
        
        for (const docInfo of index.documents) {
          const doc = await this.getCachedDocument(docInfo.id);
          if (doc) {
            keyRequirements.push(...doc.processedContent.requirements.slice(0, 3));
            if (doc.processedContent.complianceFramework) {
              complianceFrameworks.push(doc.processedContent.complianceFramework);
            }
          }
        }

        return {
          totalDocuments: index.totalDocuments,
          categories: index.categories,
          latestUpdates: index.documents.map(d => `${d.title} (${d.lastUpdated})`).slice(0, 5),
          keyRequirements: [...new Set(keyRequirements)].slice(0, 10),
          complianceFrameworks: [...new Set(complianceFrameworks)],
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get documentation summary: ${error.message}`);
    }

    return {
      totalDocuments: 0,
      categories: {},
      latestUpdates: [],
      keyRequirements: [],
      complianceFrameworks: [],
    };
  }

  /**
   * Search documents for specific content
   */
  async searchDocuments(query: string, category?: string): Promise<GovernmentDocument[]> {
    const results: GovernmentDocument[] = [];
    
    for (const source of this.governmentSources) {
      if (category && source.category !== category) continue;
      
      const document = await this.getCachedDocument(source.id);
      if (document && document.content.toLowerCase().includes(query.toLowerCase())) {
        results.push(document);
      }
    }

    return results;
  }

  /**
   * Get DEFRA conversion factors for specific year and category
   */
  async getDEFRAConversionFactors(
    year?: number,
    category?: string
  ): Promise<any[]> {
    try {
      if (year && category) {
        return await this.defraCollector.getConversionFactors(year, category);
      } else if (year) {
        return await this.defraCollector.getConversionFactors(year);
      } else {
        // Get latest year factors
        const currentYear = new Date().getFullYear();
        const factors = await this.defraCollector.getConversionFactors(currentYear);
        
        // If current year not available, try previous year
        if (factors.length === 0) {
          return await this.defraCollector.getConversionFactors(currentYear - 1);
        }
        
        return factors;
      }
    } catch (error) {
      this.logger.error(`Failed to get DEFRA conversion factors: ${error.message}`);
      return [];
    }
  }

  /**
   * Get DEFRA conversion factor trends for analysis
   */
  async getDEFRAConversionFactorTrends(category?: string): Promise<any[]> {
    try {
      return await this.defraCollector.getConversionFactorTrends(category);
    } catch (error) {
      this.logger.error(`Failed to get DEFRA conversion factor trends: ${error.message}`);
      return [];
    }
  }

  /**
   * Get comprehensive documentation and DEFRA data summary
   */
  async getComprehensiveSummary(): Promise<{
    totalDocuments: number;
    categories: Record<string, number>;
    latestUpdates: string[];
    keyRequirements: string[];
    complianceFrameworks: string[];
    defraData?: {
      totalFactors: number;
      yearsCovered: number[];
      categories: string[];
      trendsCount: number;
      latestYear: number;
      oldestYear: number;
    };
  }> {
    const baseSummary = await this.getDocumentationSummary();
    
    // Try to get DEFRA data summary
    try {
      const indexPath = path.join(this.baseDataPath, 'documentation-index.json');
      
      if (await this.fileExists(indexPath)) {
        const index = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
        
        if (index.defraConversionFactors) {
          return {
            ...baseSummary,
            defraData: index.defraConversionFactors,
          };
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get DEFRA data summary: ${error.message}`);
    }
    
    return baseSummary;
  }
}