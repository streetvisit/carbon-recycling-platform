/**
 * Database Migration Runner
 * 
 * Runs database migrations for supplier collaboration enhancements
 */

import fs from 'fs';
import path from 'path';

export async function runSupplierMigration(db: any): Promise<void> {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_enhance_supplier_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await db.exec(statement);
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
      } catch (error) {
        // Some ALTER TABLE statements might fail if column already exists
        // This is expected during reruns
        if (error.message.includes('duplicate column name') || 
            error.message.includes('already exists')) {
          console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`❌ Failed: ${statement.substring(0, 50)}...`);
          console.error(error);
          throw error;
        }
      }
    }
    
    console.log('🎉 Supplier collaboration migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Helper function to check if migrations are needed
export async function checkSupplierTablesSchema(db: any): Promise<boolean> {
  try {
    // Check if the new columns exist
    const tableInfo = await db.prepare(`
      PRAGMA table_info(suppliers);
    `).all();
    
    const columns = tableInfo.results?.map((row: any) => row.name) || [];
    
    // Check for key new columns
    const hasIndustry = columns.includes('industry');
    const hasRelationship = columns.includes('relationship');
    
    return hasIndustry && hasRelationship;
  } catch (error) {
    console.error('Error checking schema:', error);
    return false;
  }
}