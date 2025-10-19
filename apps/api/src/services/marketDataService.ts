import { Env } from '../index';

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
  marketCap?: number;
  supply?: number;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  timestamp: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdated: string;
}

// Carbon credit price sources - mock implementation for demo
const CARBON_SYMBOLS = ['VER-VCS', 'GS-CER', 'CAR-CRT', 'EU-ETS'];

// Crypto APIs for reference pricing
const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD', 'ADA-USD'];

export class MarketDataService {
  private env: Env;
  private websocketConnections: WebSocket[] = [];
  private priceCache: Map<string, MarketData> = new Map();
  private lastUpdate = 0;

  constructor(env: Env) {
    this.env = env;
    this.initializeMockData();
  }

  // Initialize mock carbon credit data
  private initializeMockData() {
    const baseData = {
      'VER-VCS': { basePrice: 24.50, volatility: 0.15 },
      'GS-CER': { basePrice: 31.20, volatility: 0.20 },
      'CAR-CRT': { basePrice: 18.75, volatility: 0.12 },
      'EU-ETS': { basePrice: 85.40, volatility: 0.25 }
    };

    for (const [symbol, config] of Object.entries(baseData)) {
      const price = this.generateRealisticPrice(config.basePrice, config.volatility);
      const change24h = (Math.random() - 0.5) * config.basePrice * 0.1;
      
      this.priceCache.set(symbol, {
        symbol,
        price,
        change24h,
        changePercent24h: (change24h / (price - change24h)) * 100,
        volume24h: Math.floor(Math.random() * 5000) + 1000,
        high24h: price + Math.random() * config.basePrice * 0.05,
        low24h: price - Math.random() * config.basePrice * 0.05,
        lastUpdated: new Date().toISOString(),
        supply: Math.floor(Math.random() * 1000000) + 100000
      });
    }
  }

  // Generate realistic price movements
  private generateRealisticPrice(basePrice: number, volatility: number): number {
    const randomWalk = (Math.random() - 0.5) * 2 * volatility * basePrice;
    return Math.max(basePrice + randomWalk, basePrice * 0.5);
  }

  // Get current market data for a symbol
  async getMarketData(symbol: string): Promise<MarketData | null> {
    // Update cache if stale (older than 5 seconds)
    if (Date.now() - this.lastUpdate > 5000) {
      await this.updatePrices();
    }

    return this.priceCache.get(symbol) || null;
  }

  // Get market data for all symbols
  async getAllMarketData(): Promise<MarketData[]> {
    if (Date.now() - this.lastUpdate > 5000) {
      await this.updatePrices();
    }

    return Array.from(this.priceCache.values());
  }

  // Get historical OHLCV data
  async getHistoricalData(
    symbol: string, 
    timeframe: string = '1h', 
    limit: number = 100
  ): Promise<OHLCVData[]> {
    const currentPrice = this.priceCache.get(symbol)?.price || 25.0;
    const data: OHLCVData[] = [];
    
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };

    const interval = intervals[timeframe as keyof typeof intervals] || intervals['1h'];
    let price = currentPrice * (0.95 + Math.random() * 0.1); // Start slightly different

    for (let i = limit; i > 0; i--) {
      const timestamp = Date.now() - (i * interval);
      const volatility = 0.02; // 2% volatility per period
      
      const open = price;
      const change = (Math.random() - 0.5) * price * volatility;
      const close = Math.max(open + change, price * 0.5);
      
      const highExtra = Math.random() * price * volatility * 0.5;
      const lowReduction = Math.random() * price * volatility * 0.5;
      
      const high = Math.max(open, close) + highExtra;
      const low = Math.min(open, close) - lowReduction;
      
      const volume = Math.floor(Math.random() * 1000) + 100;

      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });

      price = close; // Next period starts where this one ended
    }

    return data;
  }

  // Get order book data
  async getOrderBook(symbol: string): Promise<OrderBook> {
    const marketData = await this.getMarketData(symbol);
    const currentPrice = marketData?.price || 25.0;
    
    const generateOrders = (basePrice: number, side: 'buy' | 'sell', count: number = 10) => {
      const orders: OrderBookEntry[] = [];
      const priceStep = basePrice * 0.001; // 0.1% steps
      
      for (let i = 0; i < count; i++) {
        const priceOffset = (i + 1) * priceStep;
        const price = side === 'buy' ? 
          basePrice - priceOffset : 
          basePrice + priceOffset;
        
        const size = Math.floor(Math.random() * 500) + 50;
        
        orders.push({
          price: Math.round(price * 100) / 100,
          size,
          timestamp: Date.now()
        });
      }
      
      return orders.sort((a, b) => 
        side === 'buy' ? b.price - a.price : a.price - b.price
      );
    };

    return {
      symbol,
      bids: generateOrders(currentPrice, 'buy', 15),
      asks: generateOrders(currentPrice, 'sell', 15),
      lastUpdated: new Date().toISOString()
    };
  }

  // Update all prices with realistic movements
  private async updatePrices() {
    for (const [symbol, data] of this.priceCache.entries()) {
      const volatility = this.getVolatilityForSymbol(symbol);
      const priceChange = (Math.random() - 0.5) * data.price * volatility * 0.01; // 1% of volatility per update
      
      const newPrice = Math.max(data.price + priceChange, data.price * 0.1);
      const change24h = data.change24h + priceChange;
      
      this.priceCache.set(symbol, {
        ...data,
        price: Math.round(newPrice * 100) / 100,
        change24h: Math.round(change24h * 100) / 100,
        changePercent24h: Math.round((change24h / (newPrice - change24h)) * 10000) / 100,
        volume24h: data.volume24h + Math.floor(Math.random() * 100),
        lastUpdated: new Date().toISOString()
      });
    }
    
    this.lastUpdate = Date.now();
  }

  private getVolatilityForSymbol(symbol: string): number {
    const volatilities: { [key: string]: number } = {
      'VER-VCS': 0.15,
      'GS-CER': 0.20,
      'CAR-CRT': 0.12,
      'EU-ETS': 0.25
    };
    
    return volatilities[symbol] || 0.15;
  }

  // WebSocket connections for real-time updates
  async addWebSocketConnection(ws: WebSocket) {
    this.websocketConnections.push(ws);
    
    // Send initial data
    const allData = await this.getAllMarketData();
    ws.send(JSON.stringify({
      type: 'market_data',
      data: allData,
      timestamp: Date.now()
    }));

    // Clean up on close
    ws.addEventListener('close', () => {
      this.websocketConnections = this.websocketConnections.filter(conn => conn !== ws);
    });
  }

  // Broadcast price updates to all connected clients
  private broadcastUpdate(data: MarketData[]) {
    const message = JSON.stringify({
      type: 'price_update',
      data,
      timestamp: Date.now()
    });

    this.websocketConnections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      } catch (error) {
        console.error('Error broadcasting to websocket:', error);
      }
    });
  }

  // Start real-time price updates
  startPriceUpdates(intervalMs: number = 5000) {
    setInterval(async () => {
      await this.updatePrices();
      const allData = await this.getAllMarketData();
      this.broadcastUpdate(allData);
    }, intervalMs);
  }

  // Integration with external APIs (placeholder for real implementation)
  async fetchExternalPrices(): Promise<void> {
    try {
      // Placeholder for real API integrations
      // Example: Coinbase for crypto reference prices
      // Example: Carbon registry APIs for real carbon credit prices
      
      // For now, we'll simulate external price updates
      console.log('Fetching external prices...');
      
      // In a real implementation, you would:
      // 1. Call Coinbase Pro API for crypto prices
      // 2. Call carbon registry APIs for carbon credit prices
      // 3. Call financial data providers for market data
      
    } catch (error) {
      console.error('Error fetching external prices:', error);
    }
  }

  // Get trading pairs with metadata
  async getTradingPairs(): Promise<Array<{
    symbol: string;
    name: string;
    baseAsset: string;
    quoteAsset: string;
    minTradeSize: number;
    pricePrecision: number;
    status: string;
  }>> {
    return [
      {
        symbol: 'VER-VCS',
        name: 'Verified Carbon Standard',
        baseAsset: 'VER',
        quoteAsset: 'GBP',
        minTradeSize: 1,
        pricePrecision: 2,
        status: 'active'
      },
      {
        symbol: 'GS-CER',
        name: 'Gold Standard Credits',
        baseAsset: 'GS',
        quoteAsset: 'GBP',
        minTradeSize: 1,
        pricePrecision: 2,
        status: 'active'
      },
      {
        symbol: 'CAR-CRT',
        name: 'Climate Action Reserve',
        baseAsset: 'CAR',
        quoteAsset: 'GBP',
        minTradeSize: 1,
        pricePrecision: 2,
        status: 'active'
      },
      {
        symbol: 'EU-ETS',
        name: 'EU Emissions Trading System',
        baseAsset: 'EUA',
        quoteAsset: 'EUR',
        minTradeSize: 1,
        pricePrecision: 2,
        status: 'active'
      }
    ];
  }

  // Price alerts and notifications
  async checkPriceAlerts(userId: string): Promise<Array<{
    symbol: string;
    condition: string;
    targetPrice: number;
    currentPrice: number;
    triggered: boolean;
  }>> {
    // Placeholder for price alert system
    // In production, this would check user-defined price alerts
    // and send notifications when triggered
    return [];
  }
}

// Export singleton instance
let marketDataServiceInstance: MarketDataService | null = null;

export function getMarketDataService(env: Env): MarketDataService {
  if (!marketDataServiceInstance) {
    marketDataServiceInstance = new MarketDataService(env);
    // Start real-time updates
    marketDataServiceInstance.startPriceUpdates();
  }
  
  return marketDataServiceInstance;
}