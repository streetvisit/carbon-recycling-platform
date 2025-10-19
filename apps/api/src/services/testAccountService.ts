import { Env } from '../index';

export interface TestAccount {
  id: string;
  userId: string;
  balance: number;
  initialBalance: number;
  demoMode: boolean;
  resetDate: string;
  createdAt: string;
  lastActivity: string;
}

export interface TestTrade {
  id: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  status: 'pending' | 'filled' | 'cancelled';
  executedAt?: string;
  createdAt: string;
}

export interface TestPortfolio {
  accountId: string;
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentValue: number;
    unrealizedPnL: number;
  }>;
  totalValue: number;
  cashBalance: number;
  totalPnL: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'trading' | 'learning' | 'portfolio' | 'streak';
  unlocked: boolean;
  unlockedAt?: string;
  progress?: {
    current: number;
    target: number;
  };
}

export class TestAccountService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // Create or get test account for user
  async getOrCreateTestAccount(userId: string): Promise<TestAccount> {
    try {
      // Check if user already has a test account
      const existingAccount = await this.env.DB
        .prepare('SELECT * FROM test_accounts WHERE user_id = ?')
        .bind(userId)
        .first<TestAccount>();

      if (existingAccount) {
        return existingAccount;
      }

      // Create new test account
      const accountId = crypto.randomUUID();
      const initialBalance = 100000; // £100,000 demo balance
      const now = new Date().toISOString();

      const account: TestAccount = {
        id: accountId,
        userId,
        balance: initialBalance,
        initialBalance,
        demoMode: true,
        resetDate: now,
        createdAt: now,
        lastActivity: now
      };

      await this.env.DB
        .prepare(`
          INSERT INTO test_accounts (id, user_id, balance, initial_balance, demo_mode, reset_date, created_at, last_activity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          account.id,
          account.userId,
          account.balance,
          account.initialBalance,
          account.demoMode ? 1 : 0,
          account.resetDate,
          account.createdAt,
          account.lastActivity
        )
        .run();

      return account;
    } catch (error) {
      console.error('Error creating test account:', error);
      throw new Error('Failed to create test account');
    }
  }

  // Place a demo trade
  async placeDemoTrade(
    accountId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price?: number,
    orderType: 'market' | 'limit' = 'market'
  ): Promise<TestTrade> {
    try {
      const account = await this.getTestAccount(accountId);
      if (!account) {
        throw new Error('Test account not found');
      }

      // Get current market price if not specified
      const marketPrice = price || await this.getMarketPrice(symbol);
      const total = quantity * marketPrice;

      // Validate sufficient balance for buy orders
      if (side === 'buy' && account.balance < total) {
        throw new Error('Insufficient balance for trade');
      }

      // Validate sufficient holdings for sell orders
      if (side === 'sell') {
        const position = await this.getPosition(accountId, symbol);
        if (!position || position.quantity < quantity) {
          throw new Error('Insufficient holdings to sell');
        }
      }

      const tradeId = crypto.randomUUID();
      const now = new Date().toISOString();

      const trade: TestTrade = {
        id: tradeId,
        accountId,
        symbol,
        side,
        quantity,
        price: marketPrice,
        total,
        status: orderType === 'market' ? 'filled' : 'pending',
        executedAt: orderType === 'market' ? now : undefined,
        createdAt: now
      };

      // Insert trade record
      await this.env.DB
        .prepare(`
          INSERT INTO demo_trades (id, account_id, symbol, side, quantity, price, total, status, executed_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          trade.id,
          trade.accountId,
          trade.symbol,
          trade.side,
          trade.quantity,
          trade.price,
          trade.total,
          trade.status,
          trade.executedAt,
          trade.createdAt
        )
        .run();

      // Execute trade immediately for market orders
      if (orderType === 'market') {
        await this.executeTrade(trade);
      }

      // Update account activity
      await this.updateAccountActivity(accountId);

      return trade;
    } catch (error) {
      console.error('Error placing demo trade:', error);
      throw error;
    }
  }

  // Execute a trade (update balances and positions)
  private async executeTrade(trade: TestTrade): Promise<void> {
    try {
      const account = await this.getTestAccount(trade.accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      if (trade.side === 'buy') {
        // Deduct cash, add position
        const newBalance = account.balance - trade.total;
        await this.updateAccountBalance(trade.accountId, newBalance);
        await this.addToPosition(trade.accountId, trade.symbol, trade.quantity, trade.price);
      } else {
        // Add cash, reduce position
        const newBalance = account.balance + trade.total;
        await this.updateAccountBalance(trade.accountId, newBalance);
        await this.reducePosition(trade.accountId, trade.symbol, trade.quantity, trade.price);
      }

      // Update trade status
      await this.env.DB
        .prepare('UPDATE demo_trades SET status = ?, executed_at = ? WHERE id = ?')
        .bind('filled', new Date().toISOString(), trade.id)
        .run();

    } catch (error) {
      console.error('Error executing trade:', error);
      throw error;
    }
  }

  // Get test account by ID
  async getTestAccount(accountId: string): Promise<TestAccount | null> {
    try {
      return await this.env.DB
        .prepare('SELECT * FROM test_accounts WHERE id = ?')
        .bind(accountId)
        .first<TestAccount>();
    } catch (error) {
      console.error('Error fetching test account:', error);
      return null;
    }
  }

  // Get demo trades for account
  async getDemoTrades(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TestTrade[]> {
    try {
      const trades = await this.env.DB
        .prepare(`
          SELECT * FROM demo_trades 
          WHERE account_id = ? 
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        `)
        .bind(accountId, limit, offset)
        .all<TestTrade>();

      return trades.results || [];
    } catch (error) {
      console.error('Error fetching demo trades:', error);
      return [];
    }
  }

  // Get portfolio for test account
  async getTestPortfolio(accountId: string): Promise<TestPortfolio> {
    try {
      const account = await this.getTestAccount(accountId);
      if (!account) {
        throw new Error('Test account not found');
      }

      const positions = await this.getPositions(accountId);
      let totalValue = account.balance; // Start with cash balance
      let totalPnL = 0;

      // Calculate current values and P&L for each position
      for (const position of positions) {
        const currentPrice = await this.getMarketPrice(position.symbol);
        const currentValue = position.quantity * currentPrice;
        const costBasis = position.quantity * position.averageCost;
        const unrealizedPnL = currentValue - costBasis;

        position.currentValue = currentValue;
        position.unrealizedPnL = unrealizedPnL;

        totalValue += currentValue;
        totalPnL += unrealizedPnL;
      }

      // Add realized P&L from closed positions
      const realizedPnL = await this.calculateRealizedPnL(accountId);
      totalPnL += realizedPnL;

      return {
        accountId,
        positions,
        totalValue,
        cashBalance: account.balance,
        totalPnL
      };
    } catch (error) {
      console.error('Error calculating test portfolio:', error);
      throw error;
    }
  }

  // Reset demo account balance
  async resetTestAccount(accountId: string): Promise<TestAccount> {
    try {
      const account = await this.getTestAccount(accountId);
      if (!account) {
        throw new Error('Test account not found');
      }

      const now = new Date().toISOString();

      // Reset balance to initial amount
      await this.env.DB
        .prepare(`
          UPDATE test_accounts 
          SET balance = initial_balance, reset_date = ?, last_activity = ?
          WHERE id = ?
        `)
        .bind(now, now, accountId)
        .run();

      // Clear all positions (in a real system, you might archive them)
      await this.env.DB
        .prepare('DELETE FROM test_positions WHERE account_id = ?')
        .bind(accountId)
        .run();

      // Clear trade history (optional - you might want to keep for learning)
      await this.env.DB
        .prepare('DELETE FROM demo_trades WHERE account_id = ?')
        .bind(accountId)
        .run();

      return await this.getTestAccount(accountId) as TestAccount;
    } catch (error) {
      console.error('Error resetting test account:', error);
      throw error;
    }
  }

  // Get user achievements
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      // Get user's test account
      const account = await this.getOrCreateTestAccount(userId);
      const portfolio = await this.getTestPortfolio(account.id);
      const trades = await this.getDemoTrades(account.id);

      const achievements: Achievement[] = [
        {
          id: 'first_trade',
          name: 'First Trade',
          description: 'Complete your first demo trade',
          icon: '🎯',
          category: 'trading',
          unlocked: trades.length > 0,
          unlockedAt: trades.length > 0 ? trades[trades.length - 1].createdAt : undefined
        },
        {
          id: 'profitable_trader',
          name: 'Profitable Trader',
          description: 'Achieve positive total P&L',
          icon: '💰',
          category: 'trading',
          unlocked: portfolio.totalPnL > 0
        },
        {
          id: 'diversified_portfolio',
          name: 'Diversified Portfolio',
          description: 'Hold positions in 3 different carbon credits',
          icon: '🏆',
          category: 'portfolio',
          unlocked: portfolio.positions.length >= 3,
          progress: {
            current: portfolio.positions.length,
            target: 3
          }
        },
        {
          id: 'high_roller',
          name: 'High Roller',
          description: 'Complete a trade worth £10,000 or more',
          icon: '💎',
          category: 'trading',
          unlocked: trades.some(t => t.total >= 10000)
        },
        {
          id: 'day_trader',
          name: 'Day Trader',
          description: 'Complete 10 trades in one day',
          icon: '⚡',
          category: 'trading',
          unlocked: this.checkDayTradingAchievement(trades),
          progress: {
            current: this.getTradesToday(trades).length,
            target: 10
          }
        }
      ];

      return achievements;
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  }

  // Helper methods
  private async getMarketPrice(symbol: string): Promise<number> {
    // In a real implementation, this would fetch from market data service
    const prices: { [key: string]: number } = {
      'VER-VCS': 24.50,
      'GS-CER': 31.20,
      'CAR-CRT': 18.75,
      'EU-ETS': 85.40
    };

    return prices[symbol] || 25.0;
  }

  private async getPosition(accountId: string, symbol: string) {
    try {
      return await this.env.DB
        .prepare('SELECT * FROM test_positions WHERE account_id = ? AND symbol = ?')
        .bind(accountId, symbol)
        .first();
    } catch (error) {
      return null;
    }
  }

  private async getPositions(accountId: string): Promise<Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentValue: number;
    unrealizedPnL: number;
  }>> {
    try {
      const positions = await this.env.DB
        .prepare('SELECT * FROM test_positions WHERE account_id = ? AND quantity > 0')
        .bind(accountId)
        .all();

      return (positions.results || []).map((p: any) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        averageCost: p.average_cost,
        currentValue: 0, // Will be calculated
        unrealizedPnL: 0 // Will be calculated
      }));
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  private async addToPosition(accountId: string, symbol: string, quantity: number, price: number) {
    try {
      const existing = await this.getPosition(accountId, symbol);
      
      if (existing) {
        // Update existing position with weighted average cost
        const totalQuantity = existing.quantity + quantity;
        const totalCost = (existing.quantity * existing.average_cost) + (quantity * price);
        const newAverageCost = totalCost / totalQuantity;

        await this.env.DB
          .prepare(`
            UPDATE test_positions 
            SET quantity = ?, average_cost = ?, updated_at = ?
            WHERE account_id = ? AND symbol = ?
          `)
          .bind(totalQuantity, newAverageCost, new Date().toISOString(), accountId, symbol)
          .run();
      } else {
        // Create new position
        await this.env.DB
          .prepare(`
            INSERT INTO test_positions (id, account_id, symbol, quantity, average_cost, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            accountId,
            symbol,
            quantity,
            price,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
      }
    } catch (error) {
      console.error('Error adding to position:', error);
      throw error;
    }
  }

  private async reducePosition(accountId: string, symbol: string, quantity: number, price: number) {
    try {
      const existing = await this.getPosition(accountId, symbol);
      if (!existing) {
        throw new Error('No position found to reduce');
      }

      const newQuantity = existing.quantity - quantity;
      
      if (newQuantity <= 0) {
        // Remove position entirely
        await this.env.DB
          .prepare('DELETE FROM test_positions WHERE account_id = ? AND symbol = ?')
          .bind(accountId, symbol)
          .run();
      } else {
        // Reduce position
        await this.env.DB
          .prepare(`
            UPDATE test_positions 
            SET quantity = ?, updated_at = ?
            WHERE account_id = ? AND symbol = ?
          `)
          .bind(newQuantity, new Date().toISOString(), accountId, symbol)
          .run();
      }
    } catch (error) {
      console.error('Error reducing position:', error);
      throw error;
    }
  }

  private async updateAccountBalance(accountId: string, newBalance: number) {
    await this.env.DB
      .prepare('UPDATE test_accounts SET balance = ?, last_activity = ? WHERE id = ?')
      .bind(newBalance, new Date().toISOString(), accountId)
      .run();
  }

  private async updateAccountActivity(accountId: string) {
    await this.env.DB
      .prepare('UPDATE test_accounts SET last_activity = ? WHERE id = ?')
      .bind(new Date().toISOString(), accountId)
      .run();
  }

  private async calculateRealizedPnL(accountId: string): Promise<number> {
    // Simplified calculation - in a real system, this would be more complex
    // tracking cost basis and realized gains/losses from sales
    return 0;
  }

  private checkDayTradingAchievement(trades: TestTrade[]): boolean {
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = trades.filter(t => t.createdAt.startsWith(today));
    return todayTrades.length >= 10;
  }

  private getTradesToday(trades: TestTrade[]): TestTrade[] {
    const today = new Date().toISOString().split('T')[0];
    return trades.filter(t => t.createdAt.startsWith(today));
  }
}

// Export singleton instance
let testAccountServiceInstance: TestAccountService | null = null;

export function getTestAccountService(env: Env): TestAccountService {
  if (!testAccountServiceInstance) {
    testAccountServiceInstance = new TestAccountService(env);
  }
  
  return testAccountServiceInstance;
}