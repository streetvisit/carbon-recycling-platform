import { Env } from '../../index';

export async function createTradingTables(env: Env): Promise<void> {
  const db = env.DB;
  
  try {
    // Test Accounts Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS test_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        balance DECIMAL(20,8) DEFAULT 100000.00,
        initial_balance DECIMAL(20,8) DEFAULT 100000.00,
        demo_mode BOOLEAN DEFAULT true,
        reset_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Demo Trades Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS demo_trades (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
        quantity DECIMAL(20,8) NOT NULL,
        price DECIMAL(20,8) NOT NULL,
        total DECIMAL(20,8) NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled')),
        executed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES test_accounts(id)
      )
    `);

    // Test Positions Table  
    await db.exec(`
      CREATE TABLE IF NOT EXISTS test_positions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
        average_cost DECIMAL(20,8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES test_accounts(id),
        UNIQUE(account_id, symbol)
      )
    `);

    // Market Data Table (for caching/historical data)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS market_data (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        open_price DECIMAL(20,8),
        high_price DECIMAL(20,8),
        low_price DECIMAL(20,8),
        close_price DECIMAL(20,8),
        volume DECIMAL(20,8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Carbon Markets Table (trading pairs metadata)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS carbon_markets (
        id TEXT PRIMARY KEY,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        base_currency TEXT DEFAULT 'GBP',
        min_trade_size DECIMAL(10,2) DEFAULT 1.0,
        price_precision INTEGER DEFAULT 2,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'delisted')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Blog Posts Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        author_id TEXT,
        author_name TEXT,
        author_role TEXT,
        category TEXT DEFAULT 'Market Analysis',
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // KYC Applications Table (for compliance)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS kyc_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        verification_level INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'review')),
        documents TEXT, -- JSON array of document URLs
        risk_score INTEGER DEFAULT 0,
        notes TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Insert sample carbon markets
    await db.exec(`
      INSERT OR IGNORE INTO carbon_markets (id, symbol, name, description, base_currency, min_trade_size, price_precision) VALUES
        ('ver-vcs', 'VER-VCS', 'Verified Carbon Standard', 'High-quality nature-based and technology-based carbon credits', 'GBP', 1.0, 2),
        ('gs-cer', 'GS-CER', 'Gold Standard Credits', 'Premium certified emission reductions with sustainable development benefits', 'GBP', 1.0, 2),
        ('car-crt', 'CAR-CRT', 'Climate Action Reserve', 'North American carbon offset registry focusing on compliance-grade credits', 'GBP', 1.0, 2),
        ('eu-ets', 'EU-ETS', 'EU Emissions Trading System', 'European Union allowances for compliance carbon trading', 'EUR', 1.0, 2)
    `);

    // Insert sample blog posts
    await db.exec(`
      INSERT OR IGNORE INTO blog_posts (id, title, slug, content, excerpt, author_name, author_role, category, status, published_at) VALUES
        ('blog-1', 'Carbon Credit Prices Surge 15% Following UK Climate Policy Announcement', 'carbon-prices-surge-uk-climate-policy', 
         'VER-VCS and Gold Standard credits see significant uptick as UK government announces ambitious net-zero targets...', 
         'VER-VCS and Gold Standard credits see significant uptick as UK government announces ambitious net-zero targets with mandatory corporate reporting requirements.',
         'Sarah Thompson', 'Senior Market Analyst', 'Market Analysis', 'published', '2024-01-15 09:00:00'),
        ('blog-2', 'Weekly Market Update: Voluntary Carbon Markets Show Strong Growth', 'weekly-market-update-vcm-growth',
         'Trading volumes increased 23% week-over-week as corporate demand continues to outpace supply...', 
         'Trading volumes increased 23% week-over-week as corporate demand continues to outpace supply across all major registries.',
         'Michael Chen', 'Market Data Analyst', 'Market Update', 'published', '2024-01-12 14:30:00'),
        ('blog-3', 'Understanding Nature-Based Solutions: A Guide for Corporate Buyers', 'nature-based-solutions-corporate-guide',
         'Learn how forestry, agriculture, and blue carbon projects can fit into your carbon offset strategy...', 
         'Learn how forestry, agriculture, and blue carbon projects can fit into your carbon offset strategy with real-world examples.',
         'Dr. Emma Rodriguez', 'Sustainability Consultant', 'Educational', 'published', '2024-01-10 11:00:00')
    `);

    console.log('Trading platform tables created successfully');
  } catch (error) {
    console.error('Error creating trading tables:', error);
    throw error;
  }
}

export async function checkTradingTablesExist(env: Env): Promise<boolean> {
  try {
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name IN ('test_accounts', 'demo_trades', 'test_positions', 'carbon_markets')
    `).first<{ count: number }>();
    
    return (result?.count || 0) >= 4;
  } catch (error) {
    console.error('Error checking trading tables:', error);
    return false;
  }
}