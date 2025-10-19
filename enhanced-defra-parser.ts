#!/usr/bin/env npx ts-node

import 'reflect-metadata';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface ParsedConversionFactor {
  year: number;
  category: string;
  activity: string;
  fuel?: string;
  unit: string;
  kgCO2e: number;
  kgCO2?: number;
  kgCH4?: number;
  kgN2O?: number;
  scope: 1 | 2 | 3;
  source: string;
  sheet: string;
}

class EnhancedDEFRAParser {
  private readonly rawFilesPath = path.join(process.cwd(), 'data', 'defra-conversion-factors', 'raw-files');
  private readonly outputPath = path.join(process.cwd(), 'data', 'defra-conversion-factors');

  async parseAllFiles(): Promise<ParsedConversionFactor[]> {
    console.log('🚀 Enhanced DEFRA Parser Starting...');
    
    const files = fs.readdirSync(this.rawFilesPath).filter(f => f.endsWith('.xlsx'));
    console.log(`📁 Found ${files.length} Excel files to parse`);

    let allFactors: ParsedConversionFactor[] = [];
    
    for (const file of files.sort()) {
      const year = parseInt(file.match(/(\d{4})/)?.[1] || '0');
      if (year === 0) continue;

      console.log(`\n📊 Processing ${year}...`);
      
      try {
        const factors = await this.parseYearFile(year);
        allFactors = allFactors.concat(factors);
        console.log(`   ✅ Extracted ${factors.length} conversion factors`);
      } catch (error: any) {
        console.error(`   ❌ Failed to parse ${year}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Total conversion factors extracted: ${allFactors.length}`);
    
    // Save enhanced database
    await this.saveEnhancedDatabase(allFactors);
    
    return allFactors;
  }

  private async parseYearFile(year: number): Promise<ParsedConversionFactor[]> {
    const filePath = path.join(this.rawFilesPath, `conversion-factors-${year}.xlsx`);
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    let factors: ParsedConversionFactor[] = [];

    // Define data sheets (skip metadata sheets)
    const dataSheets = workbook.SheetNames.filter(name => {
      const lower = name.toLowerCase();
      return !lower.includes('introduction') &&
             !lower.includes('contents') &&
             !lower.includes('notes') &&
             !lower.includes('methodology') &&
             !lower.includes('summary') &&
             !lower.includes('cover') &&
             !lower.includes('what\'s new') &&
             !lower.includes('update') &&
             !lower.includes('datasource') &&
             !lower.includes('how to') &&
             !lower.includes('index');
    });

    for (const sheetName of dataSheets) {
      try {
        const sheetFactors = await this.parseSheet(workbook, sheetName, year);
        factors = factors.concat(sheetFactors);
      } catch (error: any) {
        console.log(`     ⚠️  Sheet "${sheetName}": ${error.message}`);
      }
    }

    return factors;
  }

  private async parseSheet(workbook: XLSX.WorkBook, sheetName: string, year: number): Promise<ParsedConversionFactor[]> {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (!jsonData || jsonData.length === 0) return [];

    const factors: ParsedConversionFactor[] = [];

    // Strategy 1: Look for clear header rows
    const headerRow = this.findHeaderRow(jsonData);
    
    if (headerRow !== -1) {
      // Use header-based parsing
      const headerMap = this.mapHeaders(jsonData[headerRow]);
      
      for (let i = headerRow + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const factor = this.parseFactorRow(row, headerMap, sheetName, year);
        if (factor) {
          factors.push(factor);
        }
      }
    } else {
      // Strategy 2: Pattern-based parsing for files without clear headers
      factors.push(...this.parseWithoutHeaders(jsonData, sheetName, year));
    }

    return factors;
  }

  private findHeaderRow(data: any[][]): number {
    const headerKeywords = ['activity', 'fuel', 'unit', 'co2e', 'co2', 'ch4', 'n2o', 'emission'];
    
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      const row = data[i] || [];
      const rowText = row.join(' ').toLowerCase();
      
      const matches = headerKeywords.filter(keyword => rowText.includes(keyword));
      if (matches.length >= 4) {
        return i;
      }
    }
    
    return -1;
  }

  private mapHeaders(headers: any[]): Record<string, number> {
    const headerMap: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      if (!header) return;
      const h = header.toString().toLowerCase().trim();
      
      if (h.includes('activity') || h.includes('fuel type') || h.includes('description')) {
        headerMap.activity = index;
      } else if (h.includes('fuel') && !h.includes('type')) {
        headerMap.fuel = index;
      } else if (h.includes('unit') && !h.includes('uncertainty') && !h.includes('per unit')) {
        headerMap.unit = index;
      } else if (h.includes('kg co2e') || (h.includes('co2') && h.includes('equivalent'))) {
        if (!h.includes('per unit')) {
          headerMap.kgCO2e = index;
        }
      } else if ((h === 'co2' || h.includes('kg co2e of co2')) && h.includes('per unit')) {
        headerMap.kgCO2 = index;
      } else if ((h === 'ch4' || h.includes('kg co2e of ch4')) && h.includes('per unit')) {
        headerMap.kgCH4 = index;
      } else if ((h === 'n2o' || h.includes('kg co2e of n2o')) && h.includes('per unit')) {
        headerMap.kgN2O = index;
      }
    });

    return headerMap;
  }

  private parseFactorRow(
    row: any[],
    headerMap: Record<string, number>,
    sheetName: string,
    year: number
  ): ParsedConversionFactor | null {
    const activity = this.getCellValue(row, headerMap.activity);
    const fuel = this.getCellValue(row, headerMap.fuel);
    const unit = this.getCellValue(row, headerMap.unit);
    const kgCO2e = this.getNumericValue(row, headerMap.kgCO2e);

    if (!unit || kgCO2e === null || kgCO2e === 0) {
      return null;
    }

    let activityName = '';
    if (activity) activityName = activity.toString().trim();
    if (fuel && !activityName.includes(fuel.toString())) {
      activityName = fuel.toString().trim() + (activityName ? ` - ${activityName}` : '');
    }

    if (!activityName) return null;

    const factor: ParsedConversionFactor = {
      year,
      category: this.categorizeSheet(sheetName),
      activity: activityName,
      unit: unit.toString().trim(),
      kgCO2e,
      scope: this.determineScope(sheetName, activityName),
      source: `DEFRA ${year}`,
      sheet: sheetName,
    };

    if (headerMap.fuel !== undefined) {
      const fuelValue = this.getCellValue(row, headerMap.fuel);
      if (fuelValue) factor.fuel = fuelValue.toString().trim();
    }

    // Add individual gas values
    const co2Value = this.getNumericValue(row, headerMap.kgCO2);
    if (co2Value !== null && co2Value > 0) factor.kgCO2 = co2Value;

    const ch4Value = this.getNumericValue(row, headerMap.kgCH4);
    if (ch4Value !== null && ch4Value > 0) factor.kgCH4 = ch4Value;

    const n2oValue = this.getNumericValue(row, headerMap.kgN2O);
    if (n2oValue !== null && n2oValue > 0) factor.kgN2O = n2oValue;

    return factor;
  }

  private parseWithoutHeaders(data: any[][], sheetName: string, year: number): ParsedConversionFactor[] {
    const factors: ParsedConversionFactor[] = [];
    
    // Look for rows with numeric conversion factors
    for (let i = 0; i < data.length; i++) {
      const row = data[i] || [];
      
      // Look for patterns like: [text] [text] [unit] [number]
      if (row.length >= 4) {
        let activity = '';
        let unit = '';
        let co2eValue = null;
        
        // Try to identify unit and CO2e value
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (cell && typeof cell === 'string') {
            const cellStr = cell.toString().toLowerCase();
            if (cellStr.includes('tonne') || cellStr.includes('litre') || cellStr.includes('kwh') || 
                cellStr.includes('kg') || cellStr.includes('cubic') || cellStr.includes('mile') ||
                cellStr.includes('passenger-km') || cellStr.includes('tonne-km')) {
              unit = cell.toString();
              
              // Look for numeric value in next few columns
              for (let k = j + 1; k < Math.min(j + 5, row.length); k++) {
                const numValue = this.parseNumber(row[k]);
                if (numValue !== null && numValue > 0) {
                  co2eValue = numValue;
                  
                  // Build activity name from preceding columns
                  const activityParts = [];
                  for (let l = 0; l < j; l++) {
                    if (row[l] && row[l].toString().trim()) {
                      activityParts.push(row[l].toString().trim());
                    }
                  }
                  activity = activityParts.join(' - ');
                  break;
                }
              }
              break;
            }
          }
        }
        
        if (activity && unit && co2eValue) {
          factors.push({
            year,
            category: this.categorizeSheet(sheetName),
            activity,
            unit,
            kgCO2e: co2eValue,
            scope: this.determineScope(sheetName, activity),
            source: `DEFRA ${year}`,
            sheet: sheetName,
          });
        }
      }
    }
    
    return factors;
  }

  // Helper methods
  private getCellValue(row: any[], index: number): any {
    return index !== undefined && index < row.length ? row[index] : null;
  }

  private getNumericValue(row: any[], index: number): number | null {
    const value = this.getCellValue(row, index);
    return this.parseNumber(value);
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    if (typeof value === 'number') return value;
    
    const str = value.toString().replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  private categorizeSheet(sheetName: string): string {
    const name = sheetName.toLowerCase();
    
    if (name.includes('fuel') || name.includes('bioenergy')) return 'Fuels';
    if (name.includes('electricity')) return 'Electricity';
    if (name.includes('heat') || name.includes('steam')) return 'Heat & Steam';
    if (name.includes('vehicle') || name.includes('transport')) return 'Transport';
    if (name.includes('travel') || name.includes('air') || name.includes('sea')) return 'Business Travel';
    if (name.includes('freight')) return 'Freight';
    if (name.includes('water')) return 'Water';
    if (name.includes('waste')) return 'Waste';
    if (name.includes('material')) return 'Materials';
    if (name.includes('refrigerant')) return 'Refrigerants';
    if (name.includes('hotel')) return 'Hotels';
    if (name.includes('homeworking')) return 'Homeworking';
    
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
    return 3;
  }

  private async saveEnhancedDatabase(factors: ParsedConversionFactor[]): Promise<void> {
    // Group by year and category
    const factorsByYear: Record<number, ParsedConversionFactor[]> = {};
    const factorsByCategory: Record<string, ParsedConversionFactor[]> = {};
    const categories = new Set<string>();
    const years = new Set<number>();

    factors.forEach(factor => {
      years.add(factor.year);
      categories.add(factor.category);

      if (!factorsByYear[factor.year]) {
        factorsByYear[factor.year] = [];
      }
      factorsByYear[factor.year].push(factor);

      if (!factorsByCategory[factor.category]) {
        factorsByCategory[factor.category] = [];
      }
      factorsByCategory[factor.category].push(factor);
    });

    const database = {
      lastUpdated: new Date().toISOString(),
      totalFactors: factors.length,
      totalDocuments: years.size,
      yearsCovered: Array.from(years).sort(),
      categories: Array.from(categories).sort(),
      factorsByYear,
      factorsByCategory,
      allFactors: factors,
    };

    const dbPath = path.join(this.outputPath, 'enhanced-conversion-factors-database.json');
    await fs.promises.writeFile(dbPath, JSON.stringify(database, null, 2), 'utf8');

    const summary = {
      lastUpdated: database.lastUpdated,
      totalFactors: database.totalFactors,
      totalDocuments: database.totalDocuments,
      yearsCovered: database.yearsCovered,
      categories: database.categories,
      latestYear: Math.max(...database.yearsCovered),
      oldestYear: Math.min(...database.yearsCovered),
    };

    const summaryPath = path.join(this.outputPath, 'enhanced-conversion-factors-summary.json');
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    console.log(`\n💾 Enhanced database saved:`);
    console.log(`   📊 Total factors: ${factors.length.toLocaleString()}`);
    console.log(`   📅 Years: ${Math.min(...database.yearsCovered)}-${Math.max(...database.yearsCovered)}`);
    console.log(`   📂 Categories: ${categories.size}`);
    console.log(`   💽 Database: enhanced-conversion-factors-database.json`);
    console.log(`   📄 Summary: enhanced-conversion-factors-summary.json`);
  }
}

async function main() {
  const parser = new EnhancedDEFRAParser();
  
  try {
    const factors = await parser.parseAllFiles();
    
    console.log('\n🎉 Enhanced parsing completed successfully!');
    console.log('✨ Your Carbon Recycling Platform now has comprehensive DEFRA data!');
    
    return factors;
  } catch (error: any) {
    console.error('\n❌ Enhanced parsing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}