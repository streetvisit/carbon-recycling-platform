import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

interface ConversionFactorDocument {
  year: number;
  title: string;
  url: string;
  publishedDate: string;
  lastUpdated: string;
  documentType: 'excel' | 'pdf' | 'csv';
  fileSize?: number;
  downloadUrl?: string;
  content?: {
    sheets?: ConversionFactorSheet[];
    rawData?: any;
  };
  metadata: {
    department: string;
    version?: string;
    methodology?: string;
    majorChanges?: string;
  };
}

interface ConversionFactorSheet {
  name: string;
  category: string;
  factors: ConversionFactor[];
}

interface ConversionFactor {
  activity: string;
  unit: string;
  scope: 1 | 2 | 3;
  kgCO2e: number;
  kgCO2?: number;
  kgCH4?: number;
  kgN2O?: number;
  source?: string;
  notes?: string;
  uncertainty?: number;
  category: string;
  subcategory?: string;
}

interface ConversionFactorDatabase {
  lastUpdated: string;
  totalDocuments: number;
  yearsCovered: number[];
  totalFactors: number;
  categories: string[];
  documents: ConversionFactorDocument[];
  factorsByYear: Record<number, ConversionFactor[]>;
  factorsByCategory: Record<string, ConversionFactor[]>;
  trends: {
    category: string;
    yearlyValues: { year: number; avgFactor: number }[];
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  }[];
}

export class DEFRAConversionFactorsCollector {
  private readonly logger = new Logger(DEFRAConversionFactorsCollector.name);
  private readonly baseDataPath = path.join(process.cwd(), 'data', 'defra-conversion-factors');
  private readonly cachePath = path.join(this.baseDataPath, 'cache');
  private readonly rawDataPath = path.join(this.baseDataPath, 'raw-files');
  
  private readonly COLLECTIONS_URL = 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting';
  private readonly BASE_GOV_URL = 'https://www.gov.uk';
  
  constructor() {
    this.ensureDirectoriesExist();
  }

  /**
   * Collect all conversion factor documents from 2002 to present
   */
  async collectAllConversionFactors(): Promise<ConversionFactorDatabase> {
    this.logger.log('🚀 Starting comprehensive DEFRA conversion factors collection');

    try {
      // Step 1: Parse the collections page to find all document links
      const documentLinks = await this.parseCollectionsPage();
      this.logger.log(`📋 Found ${documentLinks.length} conversion factor documents`);

      // Step 2: Process each document
      const documents: ConversionFactorDocument[] = [];
      const factorsByYear: Record<number, ConversionFactor[]> = {};
      const factorsByCategory: Record<string, ConversionFactor[]> = {};

      let processedCount = 0;
      const totalCount = documentLinks.length;

      for (const link of documentLinks) {
        try {
          this.logger.log(`📥 Processing ${link.year} conversion factors (${processedCount + 1}/${totalCount})`);
          
          const document = await this.processConversionFactorDocument(link);
          documents.push(document);

          // Extract factors if available
          if (document.content?.sheets) {
            const yearFactors: ConversionFactor[] = [];
            
            document.content.sheets.forEach(sheet => {
              sheet.factors.forEach(factor => {
                yearFactors.push(factor);
                
                // Add to category index
                if (!factorsByCategory[factor.category]) {
                  factorsByCategory[factor.category] = [];
                }
                factorsByCategory[factor.category].push(factor);
              });
            });

            factorsByYear[document.year] = yearFactors;
            this.logger.log(`   ✅ Extracted ${yearFactors.length} factors from ${document.year}`);
          }

          processedCount++;
          
          // Rate limiting
          await this.delay(1500);
        } catch (error: any) {
          this.logger.error(`❌ Failed to process ${link.year}: ${error.message}`);
        }
      }

      // Step 3: Analyze trends
      const trends = this.analyzeTrends(factorsByYear, factorsByCategory);

      // Step 4: Create comprehensive database
      const database: ConversionFactorDatabase = {
        lastUpdated: new Date().toISOString(),
        totalDocuments: documents.length,
        yearsCovered: documents.map(d => d.year).sort((a, b) => a - b),
        totalFactors: Object.values(factorsByYear).reduce((sum, factors) => sum + factors.length, 0),
        categories: Object.keys(factorsByCategory).sort(),
        documents: documents.sort((a, b) => b.year - a.year), // Most recent first
        factorsByYear,
        factorsByCategory,
        trends,
      };

      // Step 5: Save database
      await this.saveConversionFactorDatabase(database);

      this.logger.log(`✅ Collection complete! ${documents.length} documents processed, ${database.totalFactors} factors collected`);
      return database;

    } catch (error: any) {
      this.logger.error(`❌ Collection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse the collections page to find all document links
   */
  private async parseCollectionsPage(): Promise<{
    year: number;
    title: string;
    url: string;
    publishedDate: string;
  }[]> {
    this.logger.log('📄 Parsing collections page for document links');

    const response = await axios.get(this.COLLECTIONS_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Carbon-Recycling-Platform-Bot/1.0 (DEFRA Data Collection)',
      },
    });

    const $ = cheerio.load(response.data);
    const documentLinks: any[] = [];

    // Find all conversion factor links
    $('a[href*="conversion-factors"]').each((index, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const title = $link.text().trim();
      
      if (href && title.toLowerCase().includes('conversion factors')) {
        // Extract year from title
        const yearMatch = title.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          
          // Skip if year is unreasonable
          if (year >= 2002 && year <= new Date().getFullYear() + 1) {
            const fullUrl = href.startsWith('/') ? `${this.BASE_GOV_URL}${href}` : href;
            
            // Get published date from surrounding content
            const publishedDate = this.extractPublishedDate($, $link);
            
            documentLinks.push({
              year,
              title: title.trim(),
              url: fullUrl,
              publishedDate,
            });
          }
        }
      }
    });

    // Remove duplicates and sort by year
    const uniqueLinks = documentLinks
      .filter((item, index, self) => 
        index === self.findIndex(link => link.year === item.year)
      )
      .sort((a, b) => b.year - a.year);

    this.logger.log(`🎯 Found ${uniqueLinks.length} unique conversion factor documents`);
    uniqueLinks.forEach(link => {
      this.logger.log(`   📅 ${link.year}: ${link.title}`);
    });

    return uniqueLinks;
  }

  /**
   * Process a single conversion factor document
   */
  private async processConversionFactorDocument(link: {
    year: number;
    title: string;
    url: string;
    publishedDate: string;
  }): Promise<ConversionFactorDocument> {
    
    // Check cache first
    const cacheFile = path.join(this.cachePath, `conversion-factors-${link.year}.json`);
    if (await this.fileExists(cacheFile)) {
      const cached = JSON.parse(await fs.promises.readFile(cacheFile, 'utf8'));
      if (this.isCacheValid(cached)) {
        this.logger.log(`   💾 Using cached data for ${link.year}`);
        return cached;
      }
    }

    // Fetch document page
    const response = await axios.get(link.url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Carbon-Recycling-Platform-Bot/1.0 (DEFRA Data Collection)',
      },
    });

    const $ = cheerio.load(response.data);
    
    // Find download links (Excel files, PDFs, etc.)
    const downloadLinks = this.extractDownloadLinks($);
    
    const document: ConversionFactorDocument = {
      year: link.year,
      title: link.title,
      url: link.url,
      publishedDate: link.publishedDate,
      lastUpdated: new Date().toISOString(),
      documentType: this.determineDocumentType(downloadLinks),
      metadata: {
        department: 'Department for Energy Security and Net Zero',
      },
    };

    // Process Excel files if available
    if (downloadLinks.excel.length > 0) {
      try {
        document.content = await this.processExcelConversionFactors(
          downloadLinks.excel[0], 
          link.year
        );
        document.downloadUrl = downloadLinks.excel[0];
      } catch (error: any) {
        this.logger.warn(`⚠️ Failed to process Excel for ${link.year}: ${error.message}`);
      }
    }

    // Cache the processed document
    await fs.promises.writeFile(cacheFile, JSON.stringify(document, null, 2), 'utf8');

    return document;
  }

  /**
   * Process Excel conversion factors file
   */
  private async processExcelConversionFactors(
    excelUrl: string, 
    year: number
  ): Promise<{ sheets: ConversionFactorSheet[] }> {
    this.logger.log(`   📊 Processing Excel file for ${year}`);

    // Download Excel file
    const response = await axios.get(excelUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Carbon-Recycling-Platform-Bot/1.0 (DEFRA Data Collection)',
      },
    });

    // Save raw file for reference
    const rawFileName = `conversion-factors-${year}.xlsx`;
    const rawFilePath = path.join(this.rawDataPath, rawFileName);
    await fs.promises.writeFile(rawFilePath, response.data);

    // Parse Excel file
    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const sheets: ConversionFactorSheet[] = [];

    for (const sheetName of workbook.SheetNames) {
      // Skip metadata sheets
      if (this.isMetadataSheet(sheetName)) continue;

      try {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const factors = this.parseConversionFactorSheet(
          jsonData as any[][],
          sheetName,
          year
        );

        if (factors.length > 0) {
          sheets.push({
            name: sheetName,
            category: this.categorizeSheet(sheetName),
            factors,
          });
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Failed to parse sheet ${sheetName}: ${error.message}`);
      }
    }

    this.logger.log(`   ✅ Processed ${sheets.length} sheets with ${sheets.reduce((sum, s) => sum + s.factors.length, 0)} factors`);
    return { sheets };
  }

  /**
   * Parse conversion factor sheet data
   */
  private parseConversionFactorSheet(
    data: any[][],
    sheetName: string,
    year: number
  ): ConversionFactor[] {
    const factors: ConversionFactor[] = [];
    
    // Find header row
    let headerRowIndex = -1;
    const commonHeaders = ['activity', 'fuel', 'unit', 'co2', 'ch4', 'n2o', 'scope'];
    
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i] || [];
      const rowText = row.join(' ').toLowerCase();
      
      if (commonHeaders.some(header => rowText.includes(header))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      this.logger.warn(`No header row found in sheet ${sheetName}`);
      return factors;
    }

    const headers = data[headerRowIndex] || [];
    const headerMap = this.mapHeaders(headers);

    // Process data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] || [];
      
      try {
        const factor = this.parseConversionFactorRow(row, headerMap, sheetName, year);
        if (factor) {
          factors.push(factor);
        }
      } catch (error) {
        // Continue processing other rows
        continue;
      }
    }

    return factors;
  }

  /**
   * Parse a single conversion factor row
   */
  private parseConversionFactorRow(
    row: any[],
    headerMap: Record<string, number>,
    sheetName: string,
    year: number
  ): ConversionFactor | null {
    const activity = this.getCellValue(row, headerMap.activity);
    const unit = this.getCellValue(row, headerMap.unit);
    const kgCO2e = this.getNumericValue(row, headerMap.kgCO2e) || 
                   this.getNumericValue(row, headerMap.totalCO2e);

    if (!activity || !unit || kgCO2e === null || kgCO2e === 0) {
      return null;
    }

    const factor: ConversionFactor = {
      activity: activity.toString().trim(),
      unit: unit.toString().trim(),
      scope: this.determineScope(sheetName, activity.toString()),
      kgCO2e,
      category: this.categorizeSheet(sheetName),
      source: `DEFRA ${year}`,
    };

    // Add individual gas values if available
    if (headerMap.kgCO2 !== undefined) {
      const co2Value = this.getNumericValue(row, headerMap.kgCO2);
      if (co2Value !== null) factor.kgCO2 = co2Value;
    }
    if (headerMap.kgCH4 !== undefined) {
      const ch4Value = this.getNumericValue(row, headerMap.kgCH4);
      if (ch4Value !== null) factor.kgCH4 = ch4Value;
    }
    if (headerMap.kgN2O !== undefined) {
      const n2oValue = this.getNumericValue(row, headerMap.kgN2O);
      if (n2oValue !== null) factor.kgN2O = n2oValue;
    }

    // Add notes if available
    if (headerMap.notes !== undefined) {
      const notes = this.getCellValue(row, headerMap.notes);
      if (notes) factor.notes = notes.toString().trim();
    }

    return factor;
  }

  /**
   * Analyze trends across years
   */
  private analyzeTrends(
    factorsByYear: Record<number, ConversionFactor[]>,
    factorsByCategory: Record<string, ConversionFactor[]>
  ): ConversionFactorDatabase['trends'] {
    const trends: ConversionFactorDatabase['trends'] = [];
    
    for (const category of Object.keys(factorsByCategory)) {
      const categoryFactors = factorsByCategory[category];
      const yearlyAverages: { year: number; avgFactor: number }[] = [];
      
      // Calculate average factor per year for this category
      for (const year of Object.keys(factorsByYear).map(Number).sort()) {
        const yearFactors = factorsByYear[year].filter(f => f.category === category);
        if (yearFactors.length > 0) {
          const avgFactor = yearFactors.reduce((sum, f) => sum + f.kgCO2e, 0) / yearFactors.length;
          yearlyAverages.push({ year, avgFactor });
        }
      }

      if (yearlyAverages.length >= 3) {
        const firstYear = yearlyAverages[0];
        const lastYear = yearlyAverages[yearlyAverages.length - 1];
        const changePercent = ((lastYear.avgFactor - firstYear.avgFactor) / firstYear.avgFactor) * 100;
        
        let trend: 'increasing' | 'decreasing' | 'stable';
        if (changePercent > 5) trend = 'increasing';
        else if (changePercent < -5) trend = 'decreasing';
        else trend = 'stable';
        
        trends.push({
          category,
          yearlyValues: yearlyAverages,
          trend,
          changePercent: Math.round(changePercent * 100) / 100,
        });
      }
    }

    return trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }

  /**
   * Save the comprehensive conversion factor database
   */
  private async saveConversionFactorDatabase(database: ConversionFactorDatabase): Promise<void> {
    const dbPath = path.join(this.baseDataPath, 'conversion-factors-database.json');
    const summaryPath = path.join(this.baseDataPath, 'conversion-factors-summary.json');

    // Save full database
    await fs.promises.writeFile(dbPath, JSON.stringify(database, null, 2), 'utf8');

    // Save summary for quick access
    const summary = {
      lastUpdated: database.lastUpdated,
      totalDocuments: database.totalDocuments,
      yearsCovered: database.yearsCovered,
      totalFactors: database.totalFactors,
      categories: database.categories,
      trendsCount: database.trends.length,
      latestYear: Math.max(...database.yearsCovered),
      oldestYear: Math.min(...database.yearsCovered),
    };

    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    
    this.logger.log(`💾 Database saved: ${database.totalFactors} factors across ${database.totalDocuments} documents`);
  }

  // Helper methods
  private extractPublishedDate($: cheerio.CheerioAPI, $link: cheerio.Cheerio<any>): string {
    // Try to find date in surrounding content
    const datePattern = /\d{1,2}\s+\w+\s+\d{4}/;
    const parentText = $link.parent().text();
    const match = parentText.match(datePattern);
    return match ? match[0] : new Date().toISOString();
  }

  private extractDownloadLinks($: cheerio.CheerioAPI): {
    excel: string[];
    pdf: string[];
    csv: string[];
  } {
    const links: { excel: string[]; pdf: string[]; csv: string[] } = { excel: [], pdf: [], csv: [] };
    
    $('a[href]').each((index, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('/') ? `${this.BASE_GOV_URL}${href}` : href;
        
        if (href.includes('.xlsx') || href.includes('.xls')) {
          links.excel.push(fullUrl);
        } else if (href.includes('.pdf')) {
          links.pdf.push(fullUrl);
        } else if (href.includes('.csv')) {
          links.csv.push(fullUrl);
        }
      }
    });

    return links;
  }

  private determineDocumentType(downloadLinks: any): 'excel' | 'pdf' | 'csv' {
    if (downloadLinks.excel.length > 0) return 'excel';
    if (downloadLinks.csv.length > 0) return 'csv';
    return 'pdf';
  }

  private isMetadataSheet(sheetName: string): boolean {
    const metadataSheets = ['contents', 'notes', 'methodology', 'summary', 'cover'];
    return metadataSheets.some(name => sheetName.toLowerCase().includes(name));
  }

  private categorizeSheet(sheetName: string): string {
    const name = sheetName.toLowerCase();
    
    if (name.includes('fuel')) return 'Fuels';
    if (name.includes('electricity')) return 'Electricity';
    if (name.includes('heat')) return 'Heat & Steam';
    if (name.includes('transport')) return 'Transport';
    if (name.includes('travel')) return 'Business Travel';
    if (name.includes('freight')) return 'Freight';
    if (name.includes('water')) return 'Water';
    if (name.includes('waste')) return 'Waste';
    if (name.includes('material')) return 'Materials';
    if (name.includes('refrigerant')) return 'Refrigerants';
    if (name.includes('food')) return 'Food';
    if (name.includes('hotel')) return 'Hotels';
    
    return 'Other';
  }

  private determineScope(sheetName: string, activity: string): 1 | 2 | 3 {
    const combined = `${sheetName} ${activity}`.toLowerCase();
    
    // Scope 1: Direct emissions
    if (combined.includes('fuel') && !combined.includes('electricity')) return 1;
    if (combined.includes('gas') && !combined.includes('electricity')) return 1;
    if (combined.includes('refrigerant')) return 1;
    
    // Scope 2: Electricity, heat, steam
    if (combined.includes('electricity')) return 2;
    if (combined.includes('heat') || combined.includes('steam')) return 2;
    
    // Scope 3: Everything else
    if (combined.includes('transport') || combined.includes('travel')) return 3;
    if (combined.includes('waste')) return 3;
    if (combined.includes('water')) return 3;
    if (combined.includes('material')) return 3;
    if (combined.includes('hotel')) return 3;
    if (combined.includes('food')) return 3;
    
    return 3; // Default to Scope 3
  }

  private mapHeaders(headers: any[]): Record<string, number> {
    const headerMap: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      if (!header) return;
      const h = header.toString().toLowerCase().trim();
      
      // Map common header variations
      if (h.includes('activity') || h.includes('fuel') || h.includes('description')) {
        headerMap.activity = index;
      } else if (h.includes('unit') && !h.includes('uncertainty')) {
        headerMap.unit = index;
      } else if (h.includes('kg co2e') || h.includes('kgco2e') || (h.includes('co2') && h.includes('equivalent'))) {
        headerMap.kgCO2e = index;
      } else if (h === 'co2' || h === 'kg co2' || h === 'kgco2') {
        headerMap.kgCO2 = index;
      } else if (h === 'ch4' || h === 'kg ch4' || h === 'kgch4') {
        headerMap.kgCH4 = index;
      } else if (h === 'n2o' || h === 'kg n2o' || h === 'kgn2o') {
        headerMap.kgN2O = index;
      } else if (h.includes('total') && h.includes('co2e')) {
        headerMap.totalCO2e = index;
      } else if (h.includes('note') || h.includes('comment')) {
        headerMap.notes = index;
      }
    });

    return headerMap;
  }

  private getCellValue(row: any[], index: number): any {
    return index !== undefined && index < row.length ? row[index] : null;
  }

  private getNumericValue(row: any[], index: number): number | null {
    const value = this.getCellValue(row, index);
    if (value === null || value === undefined || value === '') return null;
    
    const num = typeof value === 'number' ? value : parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }

  private ensureDirectoriesExist(): void {
    const directories = [this.baseDataPath, this.cachePath, this.rawDataPath];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private isCacheValid(document: ConversionFactorDocument): boolean {
    const cacheAge = Date.now() - new Date(document.lastUpdated).getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    return cacheAge < maxAge;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get conversion factors for a specific year and category
   */
  async getConversionFactors(year: number, category?: string): Promise<ConversionFactor[]> {
    const dbPath = path.join(this.baseDataPath, 'conversion-factors-database.json');
    
    if (!await this.fileExists(dbPath)) {
      throw new Error('Conversion factors database not found. Run collection first.');
    }

    const database: ConversionFactorDatabase = JSON.parse(
      await fs.promises.readFile(dbPath, 'utf8')
    );

    const yearFactors = database.factorsByYear[year] || [];
    
    if (category) {
      return yearFactors.filter(factor => factor.category === category);
    }

    return yearFactors;
  }

  /**
   * Get conversion factor trends for analysis
   */
  async getConversionFactorTrends(category?: string): Promise<ConversionFactorDatabase['trends']> {
    const dbPath = path.join(this.baseDataPath, 'conversion-factors-database.json');
    
    if (!await this.fileExists(dbPath)) {
      throw new Error('Conversion factors database not found. Run collection first.');
    }

    const database: ConversionFactorDatabase = JSON.parse(
      await fs.promises.readFile(dbPath, 'utf8')
    );

    if (category) {
      return database.trends.filter(trend => trend.category === category);
    }

    return database.trends;
  }
}