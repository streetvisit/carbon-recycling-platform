#!/usr/bin/env npx ts-node

import 'reflect-metadata';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

async function inspectExcelFile(year: number) {
  const excelPath = path.join(process.cwd(), 'data', 'defra-conversion-factors', 'raw-files', `conversion-factors-${year}.xlsx`);
  
  if (!fs.existsSync(excelPath)) {
    console.log(`❌ File not found: ${excelPath}`);
    return;
  }

  console.log(`🔍 Inspecting DEFRA ${year} Excel file...`);
  console.log(`📁 File: ${excelPath}`);
  
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  console.log(`📊 Sheet Names (${workbook.SheetNames.length} total):`);
  workbook.SheetNames.forEach((name, index) => {
    console.log(`   ${index + 1}. "${name}"`);
  });
  
  // Examine first non-metadata sheet
  const dataSheets = workbook.SheetNames.filter(name => {
    const lower = name.toLowerCase();
    return !lower.includes('contents') && 
           !lower.includes('notes') && 
           !lower.includes('methodology') && 
           !lower.includes('summary') && 
           !lower.includes('cover') &&
           !lower.includes('what\'s new') &&
           !lower.includes('update') &&
           !lower.includes('datasource');
  });
  
  console.log(`\n📋 Data Sheets (${dataSheets.length} sheets):`);
  dataSheets.forEach(name => console.log(`   • "${name}"`));
  
  if (dataSheets.length > 0) {
    const sheetName = dataSheets[0];
    console.log(`\n🔎 Examining sheet: "${sheetName}"`);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 20 }); // First 20 rows
    
    console.log('\n📝 First 10 rows:');
    jsonData.slice(0, 10).forEach((row: any[], index) => {
      if (row && row.length > 0) {
        const rowStr = row.slice(0, 5).map(cell => cell || '').join(' | ');
        console.log(`   Row ${index}: ${rowStr}`);
      }
    });
    
    // Look for potential header patterns
    console.log('\n🎯 Looking for header patterns...');
    const headerKeywords = ['fuel', 'activity', 'unit', 'co2', 'ch4', 'n2o', 'scope', 'factor'];
    
    jsonData.slice(0, 20).forEach((row: any[], index) => {
      if (row && row.length > 0) {
        const rowText = row.join(' ').toLowerCase();
        const matchedKeywords = headerKeywords.filter(keyword => rowText.includes(keyword));
        if (matchedKeywords.length >= 2) {
          console.log(`   🎯 Potential header at row ${index}: [${matchedKeywords.join(', ')}]`);
          console.log(`      Row content: ${row.slice(0, 8).join(' | ')}`);
        }
      }
    });
  }
}

async function main() {
  console.log('🔍 DEFRA Excel File Inspector\n');
  
  // Inspect a few key years
  const yearsToInspect = [2024, 2020, 2015, 2010];
  
  for (const year of yearsToInspect) {
    await inspectExcelFile(year);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}