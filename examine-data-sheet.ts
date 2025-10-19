#!/usr/bin/env npx ts-node

import 'reflect-metadata';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

async function examineDataSheet(year: number, sheetName: string) {
  const excelPath = path.join(process.cwd(), 'data', 'defra-conversion-factors', 'raw-files', `conversion-factors-${year}.xlsx`);
  
  if (!fs.existsSync(excelPath)) {
    console.log(`❌ File not found: ${excelPath}`);
    return;
  }

  console.log(`🔍 Examining ${year} - Sheet: "${sheetName}"`);
  
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`❌ Sheet "${sheetName}" not found in ${year} workbook`);
    console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);
    return;
  }
  
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 50 }); // First 50 rows
  
  console.log(`📊 Total rows in range: ${jsonData.length}`);
  
  // Look for header patterns in first 30 rows
  console.log('\n🎯 Looking for conversion factor headers...');
  const headerKeywords = ['fuel', 'activity', 'unit', 'co2e', 'co2', 'ch4', 'n2o', 'scope', 'factor', 'emission'];
  
  let potentialHeaders = [];
  
  jsonData.slice(0, 30).forEach((row: any[], index) => {
    if (row && row.length > 2) {
      const rowText = row.join(' ').toLowerCase();
      const matchedKeywords = headerKeywords.filter(keyword => rowText.includes(keyword));
      if (matchedKeywords.length >= 3) {
        console.log(`   🎯 Strong header candidate at row ${index}: [${matchedKeywords.join(', ')}]`);
        console.log(`      Row content: ${row.slice(0, 10).join(' | ')}`);
        potentialHeaders.push({ index, row: row.slice(0, 10), score: matchedKeywords.length });
      } else if (matchedKeywords.length >= 2) {
        console.log(`   🔸 Weak header candidate at row ${index}: [${matchedKeywords.join(', ')}]`);
        console.log(`      Row content: ${row.slice(0, 8).join(' | ')}`);
      }
    }
  });
  
  if (potentialHeaders.length > 0) {
    // Use the best header
    const bestHeader = potentialHeaders.sort((a, b) => b.score - a.score)[0];
    console.log(`\n✅ Using header from row ${bestHeader.index}`);
    console.log(`   Headers: ${bestHeader.row.join(' | ')}`);
    
    // Show some data rows after the header
    console.log('\n📋 Sample data rows:');
    const startRow = bestHeader.index + 1;
    for (let i = startRow; i < Math.min(startRow + 10, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        console.log(`   Row ${i}: ${row.slice(0, bestHeader.row.length).map(cell => cell || '').join(' | ')}`);
      }
    }
  } else {
    console.log('\n❌ No clear header found. Showing first 20 rows:');
    jsonData.slice(0, 20).forEach((row: any[], index) => {
      if (row && row.length > 0) {
        console.log(`   Row ${index}: ${row.slice(0, 8).map(cell => cell || '').join(' | ')}`);
      }
    });
  }
}

async function main() {
  console.log('🔍 DEFRA Data Sheet Examiner\n');
  
  // Examine key data sheets
  const examinations = [
    { year: 2024, sheet: 'Fuels' },
    { year: 2024, sheet: 'UK electricity' },
    { year: 2020, sheet: 'Fuels' },
    { year: 2015, sheet: 'Fuels' },
  ];
  
  for (const exam of examinations) {
    await examineDataSheet(exam.year, exam.sheet);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}