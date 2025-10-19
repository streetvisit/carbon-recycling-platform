import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CarbonTradingService } from '../services/carbon-trading.service';

// Enums for Carbon Trading
export enum InstrumentType {
  EUA = 'EUA',                    // European Union Allowances
  CCA = 'CCA',                    // California Carbon Allowances  
  RGGI = 'RGGI',                  // RGGI CO2 Allowances
  UKA = 'UKA',                    // UK Allowances
  CCER = 'CCER',                  // China Certified Emission Reduction
  VCS = 'VCS',                    // Verified Carbon Standard
  GOLD_STANDARD = 'GOLD_STANDARD', // Gold Standard Credits
  CDM = 'CDM',                    // Clean Development Mechanism
  JI = 'JI',                      // Joint Implementation
  NATURE_BASED = 'NATURE_BASED', // Nature-based Solutions
  TECH_BASED = 'TECH_BASED',     // Technology-based Credits
}

export enum OrderType {
  MARKET = 'MARKET',              // Execute immediately at best price
  LIMIT = 'LIMIT',                // Execute only at specified price or better
  STOP = 'STOP',                  // Execute when price reaches stop level
  STOP_LIMIT = 'STOP_LIMIT',      // Combination of stop and limit
  IOC = 'IOC',                    // Immediate or Cancel
  FOK = 'FOK',                    // Fill or Kill
  AUCTION = 'AUCTION',            // For primary market auctions
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum SettlementType {
  PHYSICAL = 'PHYSICAL',          // Physical delivery of credits
  FINANCIAL = 'FINANCIAL',        // Cash settlement only
  MIXED = 'MIXED',               // Combination
}

export enum MarketType {
  COMPLIANCE = 'COMPLIANCE',      // Regulatory compliance markets
  VOLUNTARY = 'VOLUNTARY',        // Voluntary carbon markets
  FUTURES = 'FUTURES',           // Derivatives market
  OTC = 'OTC',                   // Over-the-counter
}

// DTOs
class CreateOrderDto {
  instrumentType: InstrumentType;
  vintage?: string;              // Year of credits (e.g., "2024")
  orderType: OrderType;
  side: OrderSide;
  quantity: number;              // Number of credits/allowances
  price?: number;                // Price per credit (required for LIMIT orders)
  stopPrice?: number;            // For stop orders
  timeInForce: 'GTC' | 'GTD' | 'IOC' | 'FOK' = 'GTC';
  expiryDate?: string;           // For GTD orders
  settlementType: SettlementType;
  deliveryDate?: string;         // For forward trades
  registryAccountId?: string;    // Target registry account
  notes?: string;
  complianceData?: {
    jurisdictionId: string;
    compliancePeriod: string;
    regulatoryReference?: string;
  };
}

class UpdateOrderDto {
  quantity?: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'GTD' | 'IOC' | 'FOK';
  expiryDate?: string;
  notes?: string;
}

class PortfolioFilter {
  instrumentType?: InstrumentType;
  vintage?: string;
  registryId?: string;
  marketType?: MarketType;
  minQuantity?: number;
  includeForwardPositions?: boolean;
}

class TradingOrderFilter {
  instrumentType?: InstrumentType;
  side?: OrderSide;
  status?: OrderStatus;
  vintage?: string;
  fromDate?: string;
  toDate?: string;
  minQuantity?: number;
  maxQuantity?: number;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

class MarketDataQuery {
  instrumentType?: InstrumentType;
  vintage?: string;
  timeframe: '1h' | '1d' | '1w' | '1m' | '1y' = '1d';
  fromDate?: string;
  toDate?: string;
  includeVolume?: boolean;
}

class AuctionParticipationDto {
  auctionId: string;
  bidQuantity: number;
  bidPrice: number;
  registryAccountId: string;
  complianceEntityId?: string;
}

class SettlementInstructionDto {
  tradeId: string;
  deliveryAccountId: string;
  paymentAccountId: string;
  settlementDate: string;
  specialInstructions?: string;
}

@ApiTags('Carbon Trading')
@ApiBearerAuth()
@Controller('trading')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CarbonTradingController {
  constructor(private readonly carbonTradingService: CarbonTradingService) {}

  // Market Data Endpoints
  @Get('market-data')
  @Roles('admin', 'manager', 'analyst', 'trader', 'viewer')
  @ApiOperation({ summary: 'Get real-time market data for carbon instruments' })
  @ApiResponse({ status: 200, description: 'Market data retrieved successfully' })
  @ApiQuery({ name: 'instrumentType', required: false, enum: InstrumentType })
  @ApiQuery({ name: 'vintage', required: false })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['1h', '1d', '1w', '1m', '1y'] })
  async getMarketData(@Query() query: MarketDataQuery) {
    return await this.carbonTradingService.getMarketData(query);
  }

  @Get('market-data/prices')
  @Roles('admin', 'manager', 'analyst', 'trader', 'viewer')
  @ApiOperation({ summary: 'Get current market prices' })
  @ApiResponse({ status: 200, description: 'Current prices retrieved successfully' })
  async getCurrentPrices(
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('vintage') vintage?: string,
  ) {
    return await this.carbonTradingService.getCurrentPrices(instrumentType, vintage);
  }

  @Get('market-data/orderbook')
  @Roles('admin', 'manager', 'analyst', 'trader', 'viewer')
  @ApiOperation({ summary: 'Get order book (bid/ask depth)' })
  @ApiResponse({ status: 200, description: 'Order book retrieved successfully' })
  async getOrderBook(
    @Query('instrumentType') instrumentType: InstrumentType,
    @Query('vintage') vintage?: string,
    @Query('depth') depth: number = 10,
  ) {
    return await this.carbonTradingService.getOrderBook(instrumentType, vintage, depth);
  }

  @Get('market-data/volume')
  @Roles('admin', 'manager', 'analyst', 'trader', 'viewer')
  @ApiOperation({ summary: 'Get trading volume statistics' })
  @ApiResponse({ status: 200, description: 'Volume data retrieved successfully' })
  async getTradingVolume(
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('limit') limit: number = 30,
  ) {
    return await this.carbonTradingService.getTradingVolume(instrumentType, period, limit);
  }

  // Order Management
  @Post('orders')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Place a new trading order' })
  @ApiResponse({ status: 201, description: 'Order placed successfully' })
  async placeOrder(
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
    @Request() req,
  ) {
    return await this.carbonTradingService.placeOrder(createOrderDto, req.user.id);
  }

  @Get('orders')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Get trading orders with filtering' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getOrders(
    @Query() filter: TradingOrderFilter,
    @Request() req,
  ) {
    return await this.carbonTradingService.getOrders(filter, req.user.id);
  }

  @Get('orders/:id')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return await this.carbonTradingService.getOrderById(id, req.user.id);
  }

  @Put('orders/:id')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Update existing order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  async updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateOrderDto: UpdateOrderDto,
    @Request() req,
  ) {
    return await this.carbonTradingService.updateOrder(id, updateOrderDto, req.user.id);
  }

  @Delete('orders/:id')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return await this.carbonTradingService.cancelOrder(id, req.user.id);
  }

  // Trade Execution and History
  @Get('trades')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get trade history' })
  @ApiResponse({ status: 200, description: 'Trade history retrieved successfully' })
  async getTradeHistory(
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Request() req,
  ) {
    return await this.carbonTradingService.getTradeHistory({
      instrumentType,
      fromDate,
      toDate,
      page,
      limit,
      userId: req.user.id,
    });
  }

  @Get('trades/:id')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get trade details' })
  @ApiResponse({ status: 200, description: 'Trade details retrieved successfully' })
  async getTradeById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return await this.carbonTradingService.getTradeById(id, req.user.id);
  }

  // Portfolio Management
  @Get('portfolio')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get carbon portfolio holdings' })
  @ApiResponse({ status: 200, description: 'Portfolio retrieved successfully' })
  async getPortfolio(
    @Query() filter: PortfolioFilter,
    @Request() req,
  ) {
    return await this.carbonTradingService.getPortfolio(filter, req.user.id);
  }

  @Get('portfolio/summary')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get portfolio summary and valuation' })
  @ApiResponse({ status: 200, description: 'Portfolio summary retrieved successfully' })
  async getPortfolioSummary(@Request() req) {
    return await this.carbonTradingService.getPortfolioSummary(req.user.id);
  }

  @Get('portfolio/positions')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get detailed position breakdown' })
  @ApiResponse({ status: 200, description: 'Positions retrieved successfully' })
  async getPositions(
    @Query('asOf') asOf?: string, // ISO date string
    @Request() req,
  ) {
    return await this.carbonTradingService.getPositions(req.user.id, asOf);
  }

  @Get('portfolio/pnl')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get profit and loss analysis' })
  @ApiResponse({ status: 200, description: 'P&L analysis retrieved successfully' })
  async getPnLAnalysis(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Request() req,
  ) {
    return await this.carbonTradingService.getPnLAnalysis({
      userId: req.user.id,
      fromDate,
      toDate,
      instrumentType,
    });
  }

  // Auction Participation
  @Get('auctions')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get available auctions' })
  @ApiResponse({ status: 200, description: 'Auctions retrieved successfully' })
  async getAuctions(
    @Query('market') market?: MarketType,
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('status') status?: 'upcoming' | 'active' | 'closed',
  ) {
    return await this.carbonTradingService.getAuctions(market, instrumentType, status);
  }

  @Post('auctions/participate')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Participate in carbon credit auction' })
  @ApiResponse({ status: 200, description: 'Auction participation submitted successfully' })
  async participateInAuction(
    @Body(ValidationPipe) participationDto: AuctionParticipationDto,
    @Request() req,
  ) {
    return await this.carbonTradingService.participateInAuction(participationDto, req.user.id);
  }

  @Get('auctions/:id/results')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get auction results' })
  @ApiResponse({ status: 200, description: 'Auction results retrieved successfully' })
  async getAuctionResults(@Param('id', ParseUUIDPipe) auctionId: string) {
    return await this.carbonTradingService.getAuctionResults(auctionId);
  }

  // Settlement and Delivery
  @Post('trades/:id/settle')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Initiate trade settlement' })
  @ApiResponse({ status: 200, description: 'Settlement initiated successfully' })
  async initiateSettlement(
    @Param('id', ParseUUIDPipe) tradeId: string,
    @Body(ValidationPipe) settlementDto: SettlementInstructionDto,
    @Request() req,
  ) {
    return await this.carbonTradingService.initiateSettlement(tradeId, settlementDto, req.user.id);
  }

  @Get('settlements')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Get settlement status and history' })
  @ApiResponse({ status: 200, description: 'Settlement data retrieved successfully' })
  async getSettlements(
    @Query('status') status?: 'pending' | 'in_progress' | 'completed' | 'failed',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Request() req,
  ) {
    return await this.carbonTradingService.getSettlements({
      status,
      fromDate,
      toDate,
      userId: req.user.id,
    });
  }

  // Risk Management
  @Get('risk/exposure')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Get trading risk exposure' })
  @ApiResponse({ status: 200, description: 'Risk exposure retrieved successfully' })
  async getRiskExposure(@Request() req) {
    return await this.carbonTradingService.getRiskExposure(req.user.id);
  }

  @Get('risk/limits')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Get trading limits and utilization' })
  @ApiResponse({ status: 200, description: 'Trading limits retrieved successfully' })
  async getTradingLimits(@Request() req) {
    return await this.carbonTradingService.getTradingLimits(req.user.id);
  }

  @Post('risk/limits')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Set trading limits' })
  @ApiResponse({ status: 200, description: 'Trading limits updated successfully' })
  async setTradingLimits(
    @Body() limits: {
      userId?: string;
      instrumentType?: InstrumentType;
      maxPositionSize: number;
      maxDailyTradingVolume: number;
      maxSingleOrderSize: number;
      marginRequirement?: number;
    },
    @Request() req,
  ) {
    return await this.carbonTradingService.setTradingLimits(limits, req.user.id);
  }

  // Compliance and Reporting
  @Get('compliance/holdings')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Get compliance holdings report' })
  @ApiResponse({ status: 200, description: 'Compliance holdings retrieved successfully' })
  async getComplianceHoldings(
    @Query('jurisdiction') jurisdiction: 'EU' | 'CA' | 'RGGI' | 'UK' | 'CN',
    @Query('compliancePeriod') compliancePeriod?: string,
    @Request() req,
  ) {
    return await this.carbonTradingService.getComplianceHoldings(jurisdiction, compliancePeriod, req.user.id);
  }

  @Get('compliance/surrender')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Get surrender obligations and schedules' })
  @ApiResponse({ status: 200, description: 'Surrender obligations retrieved successfully' })
  async getSurrenderObligations(
    @Query('jurisdiction') jurisdiction: 'EU' | 'CA' | 'RGGI' | 'UK' | 'CN',
    @Query('year') year?: number,
    @Request() req,
  ) {
    return await this.carbonTradingService.getSurrenderObligations(jurisdiction, year, req.user.id);
  }

  @Post('compliance/surrender')
  @Roles('admin', 'manager', 'trader')
  @ApiOperation({ summary: 'Submit allowances for surrender/retirement' })
  @ApiResponse({ status: 200, description: 'Surrender request submitted successfully' })
  async surrenderAllowances(
    @Body() surrenderRequest: {
      jurisdiction: 'EU' | 'CA' | 'RGGI' | 'UK' | 'CN';
      allowances: Array<{
        instrumentType: InstrumentType;
        vintage: string;
        quantity: number;
        serialNumbers?: string[];
      }>;
      compliancePeriod: string;
      surrenderDate: string;
      notes?: string;
    },
    @Request() req,
  ) {
    return await this.carbonTradingService.surrenderAllowances(surrenderRequest, req.user.id);
  }

  // Analytics and Insights
  @Get('analytics/performance')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Get trading performance analytics' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully' })
  async getTradingPerformance(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Request() req,
  ) {
    return await this.carbonTradingService.getTradingPerformance(period, instrumentType, req.user.id);
  }

  @Get('analytics/market-trends')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get market trends and forecasts' })
  @ApiResponse({ status: 200, description: 'Market trends retrieved successfully' })
  async getMarketTrends(
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('timeframe') timeframe: 'short' | 'medium' | 'long' = 'medium',
  ) {
    return await this.carbonTradingService.getMarketTrends(instrumentType, timeframe);
  }

  @Get('analytics/arbitrage')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Identify arbitrage opportunities' })
  @ApiResponse({ status: 200, description: 'Arbitrage opportunities identified' })
  async getArbitrageOpportunities(
    @Query('minSpread') minSpread: number = 0.5,
    @Query('maxRisk') maxRisk: number = 10,
  ) {
    return await this.carbonTradingService.getArbitrageOpportunities(minSpread, maxRisk);
  }

  // Export and Reporting
  @Post('export/trades')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Export trade data' })
  @ApiResponse({ status: 200, description: 'Trade export initiated successfully' })
  async exportTrades(
    @Body() exportRequest: {
      fromDate?: string;
      toDate?: string;
      instrumentType?: InstrumentType;
      format: 'csv' | 'excel' | 'xml';
      includeSettlementData?: boolean;
    },
    @Request() req,
  ) {
    return await this.carbonTradingService.exportTrades(exportRequest, req.user.id);
  }

  @Post('export/portfolio')
  @Roles('admin', 'manager', 'trader', 'analyst')
  @ApiOperation({ summary: 'Export portfolio holdings' })
  @ApiResponse({ status: 200, description: 'Portfolio export initiated successfully' })
  async exportPortfolio(
    @Body() exportRequest: {
      asOf?: string;
      format: 'csv' | 'excel' | 'pdf';
      includeValuation?: boolean;
      includeRiskMetrics?: boolean;
    },
    @Request() req,
  ) {
    return await this.carbonTradingService.exportPortfolio(exportRequest, req.user.id);
  }

  // Real-time Updates (WebSocket endpoints would be implemented separately)
  @Get('stream/prices')
  @Roles('admin', 'manager', 'trader', 'analyst', 'viewer')
  @ApiOperation({ summary: 'Get real-time price stream configuration' })
  @ApiResponse({ status: 200, description: 'Price stream configuration retrieved' })
  async getPriceStreamConfig(
    @Query('instrumentType') instrumentType?: InstrumentType,
    @Query('vintage') vintage?: string,
  ) {
    return await this.carbonTradingService.getPriceStreamConfig(instrumentType, vintage);
  }
}