import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { 
  AnalyticsMlService, 
  PredictionRequest, 
  AnalyticsCategory,
  Scenario,
  OptimizationConstraint
} from '../services/analytics-ml.service';
import { User } from '@prisma/client';

class PredictDto {
  modelId: string;
  features: Record<string, any>;
  predictionHorizon?: number;
  confidenceLevel?: number;
  includeExplanation?: boolean;
}

class ScenarioAnalysisDto {
  baselineYear: number;
  targetYear: number;
  scenarios: Scenario[];
}

class OptimizationDto {
  objective: string;
  constraints: OptimizationConstraint[];
}

@ApiTags('Analytics & Machine Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/analytics-ml')
export class AnalyticsMlController {
  private readonly logger = new Logger(AnalyticsMlController.name);

  constructor(private analyticsMlService: AnalyticsMlService) {}

  /**
   * Get available ML models
   */
  @Get('models')
  @ApiOperation({
    summary: 'Get available ML models',
    description: 'Retrieve list of all available machine learning models with their capabilities and performance metrics'
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['EMISSIONS_PREDICTION', 'ENERGY_OPTIMIZATION', 'SUPPLIER_SCORING', 'RISK_ASSESSMENT', 'TREND_ANALYSIS', 'BENCHMARK_COMPARISON', 'TARGET_TRACKING', 'SCENARIO_MODELING'],
    description: 'Filter models by category'
  })
  @ApiResponse({
    status: 200,
    description: 'List of available ML models',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'model_12345' },
              name: { type: 'string', example: 'Emissions Forecasting Model' },
              type: { 
                type: 'string', 
                enum: ['FORECASTING', 'CLASSIFICATION', 'ANOMALY_DETECTION', 'CLUSTERING', 'REGRESSION', 'TIME_SERIES', 'OPTIMIZATION'],
                example: 'TIME_SERIES' 
              },
              category: { 
                type: 'string', 
                enum: ['EMISSIONS_PREDICTION', 'ENERGY_OPTIMIZATION', 'SUPPLIER_SCORING', 'RISK_ASSESSMENT'],
                example: 'EMISSIONS_PREDICTION' 
              },
              description: { type: 'string', example: 'Predicts future emissions based on historical data and external factors' },
              status: { 
                type: 'string', 
                enum: ['TRAINING', 'READY', 'DEPRECATED', 'ERROR', 'UPDATING'],
                example: 'READY' 
              },
              accuracy: { type: 'number', example: 0.892, description: 'Model accuracy score (0-1)' },
              lastTrained: { type: 'string', format: 'date-time' },
              features: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'historical_emissions' },
                    type: { 
                      type: 'string', 
                      enum: ['NUMERICAL', 'CATEGORICAL', 'TEMPORAL', 'TEXT'],
                      example: 'NUMERICAL' 
                    },
                    importance: { type: 'number', example: 0.85 },
                    description: { type: 'string', example: 'Past 24 months emissions data' }
                  }
                }
              },
              performance: {
                type: 'object',
                properties: {
                  accuracy: { type: 'number', example: 0.892 },
                  precision: { type: 'number', example: 0.887 },
                  recall: { type: 'number', example: 0.896 },
                  f1Score: { type: 'number', example: 0.891 },
                  predictionTime: { type: 'number', example: 150, description: 'Average prediction time in milliseconds' }
                }
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  getModels(@Query('category') category?: AnalyticsCategory) {
    this.logger.log(`Fetching ML models${category ? ` for category: ${category}` : ''}`);
    
    const models = this.analyticsMlService.listModels(category);
    
    return {
      success: true,
      data: models
    };
  }

  /**
   * Get specific model details
   */
  @Get('models/:modelId')
  @ApiOperation({
    summary: 'Get model details',
    description: 'Retrieve detailed information about a specific ML model including features, performance, and hyperparameters'
  })
  @ApiParam({
    name: 'modelId',
    description: 'Unique identifier of the ML model',
    example: 'model_12345'
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed model information',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'model_12345' },
            name: { type: 'string', example: 'Emissions Forecasting Model' },
            description: { type: 'string', example: 'Advanced time series model for emission predictions' },
            status: { type: 'string', example: 'READY' },
            accuracy: { type: 'number', example: 0.892 },
            hyperparameters: {
              type: 'object',
              example: { window_size: 12, learning_rate: 0.001, epochs: 100 }
            },
            features: { type: 'array' },
            performance: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found'
  })
  @Roles('admin', 'manager', 'user')
  getModel(@Param('modelId') modelId: string) {
    this.logger.log(`Fetching model details: ${modelId}`);
    
    const model = this.analyticsMlService.getModel(modelId);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      data: model
    };
  }

  /**
   * Make predictions using ML models
   */
  @Post('predict')
  @ApiOperation({
    summary: 'Make ML predictions',
    description: 'Use machine learning models to make predictions about emissions, energy usage, supplier risk, or other sustainability metrics'
  })
  @ApiBody({
    description: 'Prediction request parameters',
    schema: {
      type: 'object',
      properties: {
        modelId: {
          type: 'string',
          example: 'model_12345',
          description: 'ID of the ML model to use for prediction'
        },
        features: {
          type: 'object',
          example: {
            historical_emissions: 1250.5,
            energy_consumption: 850.2,
            production_volume: 10000,
            seasonality: 0.15
          },
          description: 'Input features for the prediction. Must match model requirements.'
        },
        predictionHorizon: {
          type: 'number',
          example: 12,
          description: 'Number of periods to predict (for time series models)',
          required: false
        },
        confidenceLevel: {
          type: 'number',
          example: 0.95,
          description: 'Confidence level for prediction intervals (0.90, 0.95, 0.99)',
          required: false
        },
        includeExplanation: {
          type: 'boolean',
          example: true,
          description: 'Include AI explanation of the prediction',
          required: false
        }
      },
      required: ['modelId', 'features']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Prediction completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            prediction: { 
              type: 'object',
              example: 1187.3,
              description: 'The predicted value(s)'
            },
            confidence: { 
              type: 'number', 
              example: 0.89,
              description: 'Confidence score for the prediction (0-1)'
            },
            confidenceInterval: {
              type: 'array',
              items: { type: 'number' },
              example: [1120.5, 1254.1],
              description: 'Lower and upper bounds of confidence interval'
            },
            uncertainty: {
              type: 'number',
              example: 0.08,
              description: 'Relative uncertainty of the prediction'
            },
            explanation: {
              type: 'object',
              properties: {
                topFeatures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      feature: { type: 'string', example: 'historical_emissions' },
                      importance: { type: 'number', example: 0.85 },
                      value: { type: 'number', example: 1250.5 },
                      impact: { type: 'string', enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] },
                      description: { type: 'string', example: 'Past emissions strongly influence future predictions' }
                    }
                  }
                },
                reasoning: { type: 'string', example: 'Prediction based on historical patterns and seasonal trends' },
                assumptions: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Historical patterns will continue', 'External factors remain stable']
                }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                modelVersion: { type: 'string', example: 'model_12345' },
                computationTime: { type: 'number', example: 150 },
                predictionId: { type: 'string', example: 'pred_67890' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid prediction request'
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found'
  })
  @Roles('admin', 'manager', 'user')
  async makePrediction(
    @Body() predictDto: PredictDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Making prediction with model ${predictDto.modelId} for user ${user.id}`);

    try {
      const request: PredictionRequest = {
        modelId: predictDto.modelId,
        features: predictDto.features,
        predictionHorizon: predictDto.predictionHorizon,
        confidenceLevel: predictDto.confidenceLevel || 0.95,
        includeExplanation: predictDto.includeExplanation || false
      };

      const result = await this.analyticsMlService.predict(request);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Prediction failed: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Generate analytics insights
   */
  @Post('insights/generate')
  @ApiOperation({
    summary: 'Generate analytics insights',
    description: 'Generate AI-powered insights about emissions trends, optimization opportunities, risks, and benchmarks'
  })
  @ApiResponse({
    status: 201,
    description: 'Insights generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Generated 5 new insights' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'insight_123' },
              title: { type: 'string', example: 'Significant Emissions Increase Detected' },
              description: { type: 'string', example: 'Emissions have increased by 12.3% compared to previous period' },
              type: { 
                type: 'string',
                enum: ['TREND_ALERT', 'ANOMALY_DETECTED', 'OPTIMIZATION_OPPORTUNITY', 'RISK_IDENTIFIED', 'BENCHMARK_DEVIATION', 'FORECAST_UPDATE', 'PATTERN_DISCOVERY']
              },
              severity: { 
                type: 'string',
                enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
              },
              confidence: { type: 'number', example: 0.92 },
              impact: {
                type: 'object',
                properties: {
                  financial: { type: 'number', example: 75000 },
                  environmental: { type: 'number', example: 320 },
                  operational: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                  strategic: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                  timeframe: { type: 'string', example: 'Immediate' }
                }
              },
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', example: 'Investigate root cause of emission increase' },
                    priority: { 
                      type: 'string',
                      enum: ['IMMEDIATE', 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM']
                    },
                    effort: { 
                      type: 'string',
                      enum: ['LOW', 'MEDIUM', 'HIGH']
                    },
                    expectedImpact: { type: 'number', example: 15.5 }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async generateInsights(@GetUser() user: User) {
    this.logger.log(`Generating insights for organization ${user.organizationId}`);

    try {
      const insights = await this.analyticsMlService.generateInsights(user.organizationId);

      return {
        success: true,
        message: `Generated ${insights.length} new insights`,
        data: insights
      };
    } catch (error) {
      this.logger.error(`Insight generation failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to generate insights',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get existing insights
   */
  @Get('insights')
  @ApiOperation({
    summary: 'Get analytics insights',
    description: 'Retrieve existing AI-generated insights for the organization'
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['EMISSIONS_PREDICTION', 'ENERGY_OPTIMIZATION', 'SUPPLIER_SCORING', 'RISK_ASSESSMENT', 'TREND_ANALYSIS', 'BENCHMARK_COMPARISON', 'TARGET_TRACKING', 'SCENARIO_MODELING'],
    description: 'Filter insights by category'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of insights to return',
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'List of analytics insights',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string' },
              severity: { type: 'string' },
              confidence: { type: 'number' },
              generatedAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async getInsights(
    @GetUser() user: User,
    @Query('category') category?: AnalyticsCategory,
    @Query('limit') limit?: number
  ) {
    this.logger.log(`Fetching insights for organization ${user.organizationId}`);

    try {
      const insights = await this.analyticsMlService.getInsights(
        user.organizationId,
        category,
        limit || 10
      );

      return {
        success: true,
        data: insights
      };
    } catch (error) {
      this.logger.error(`Failed to fetch insights: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to fetch insights',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Run scenario analysis
   */
  @Post('scenarios/analyze')
  @ApiOperation({
    summary: 'Run scenario analysis',
    description: 'Perform comprehensive scenario modeling to evaluate different emission reduction pathways and their outcomes'
  })
  @ApiBody({
    description: 'Scenario analysis configuration',
    schema: {
      type: 'object',
      properties: {
        baselineYear: {
          type: 'number',
          example: 2024,
          description: 'Baseline year for the analysis'
        },
        targetYear: {
          type: 'number',
          example: 2030,
          description: 'Target year for projections'
        },
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'scenario_1' },
              name: { type: 'string', example: 'Business as Usual' },
              description: { type: 'string', example: 'Continue current practices' },
              probability: { type: 'number', example: 0.7 },
              parameters: {
                type: 'object',
                example: {
                  renewable_energy_growth: 0.05,
                  efficiency_improvement: 0.02,
                  carbon_price: 75
                }
              }
            }
          }
        }
      },
      required: ['baselineYear', 'targetYear', 'scenarios']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Scenario analysis completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'analysis_789' },
            name: { type: 'string', example: 'Scenario Analysis 2024-2030' },
            results: {
              type: 'object',
              properties: {
                summary: {
                  type: 'object',
                  properties: {
                    totalEmissionsReduction: { type: 'number', example: 35 },
                    costImplications: { type: 'number', example: 2500000 },
                    timeline: { type: 'string', example: '2024-2030' },
                    feasibility: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                    riskLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }
                  }
                },
                comparisons: { type: 'array' },
                sensitivity: { type: 'array' },
                recommendations: { type: 'array' }
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async runScenarioAnalysis(
    @Body() scenarioDto: ScenarioAnalysisDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Running scenario analysis for organization ${user.organizationId}`);

    try {
      const analysis = await this.analyticsMlService.runScenarioAnalysis(
        user.organizationId,
        scenarioDto.baselineYear,
        scenarioDto.targetYear,
        scenarioDto.scenarios
      );

      return {
        success: true,
        data: analysis
      };
    } catch (error) {
      this.logger.error(`Scenario analysis failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Scenario analysis failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generate benchmark analysis
   */
  @Get('benchmarks')
  @ApiOperation({
    summary: 'Generate benchmark analysis',
    description: 'Compare organization performance against industry benchmarks and peer organizations'
  })
  @ApiResponse({
    status: 200,
    description: 'Benchmark analysis completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            organizationPerformance: {
              type: 'object',
              properties: {
                emissionIntensity: { type: 'number', example: 125.5 },
                energyEfficiency: { type: 'number', example: 0.78 },
                renewableEnergyRatio: { type: 'number', example: 0.34 },
                scope3Coverage: { type: 'number', example: 0.68 },
                dataQualityScore: { type: 'number', example: 0.82 }
              }
            },
            industryBenchmarks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sector: { type: 'string', example: 'Manufacturing' },
                  metric: { type: 'string', example: 'Emission Intensity' },
                  yourValue: { type: 'number', example: 125.5 },
                  yourPercentile: { type: 'number', example: 58 },
                  percentiles: {
                    type: 'object',
                    properties: {
                      p10: { type: 'number', example: 45 },
                      p25: { type: 'number', example: 78 },
                      p50: { type: 'number', example: 112 },
                      p75: { type: 'number', example: 156 },
                      p90: { type: 'number', example: 203 }
                    }
                  }
                }
              }
            },
            peerComparisons: { type: 'array' },
            improvementOpportunities: { type: 'array' },
            bestPractices: { type: 'array' }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async getBenchmarkAnalysis(@GetUser() user: User) {
    this.logger.log(`Generating benchmark analysis for organization ${user.organizationId}`);

    try {
      const analysis = await this.analyticsMlService.generateBenchmarkAnalysis(user.organizationId);

      return {
        success: true,
        data: analysis
      };
    } catch (error) {
      this.logger.error(`Benchmark analysis failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Benchmark analysis failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Optimize operations
   */
  @Post('optimize')
  @ApiOperation({
    summary: 'Optimize operations',
    description: 'Use AI optimization algorithms to identify the best configuration for minimizing emissions and energy consumption'
  })
  @ApiBody({
    description: 'Optimization parameters',
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          example: 'minimize_emissions',
          description: 'Optimization objective (minimize_emissions, minimize_cost, maximize_efficiency)'
        },
        constraints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'max_budget' },
              type: { type: 'string', enum: ['EQUALITY', 'INEQUALITY'] },
              expression: { type: 'string', example: 'budget <= 500000' },
              violated: { type: 'boolean', example: false },
              slack: { type: 'number', example: 50000 }
            }
          }
        }
      },
      required: ['objective']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Optimization completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            objective: { type: 'string', example: 'minimize_emissions' },
            currentValue: { type: 'number', example: 15000 },
            optimizedValue: { type: 'number', example: 13200 },
            improvement: { type: 'number', example: 12.0 },
            variables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'HVAC_schedule' },
                  currentValue: { type: 'number', example: 24 },
                  optimizedValue: { type: 'number', example: 18 },
                  sensitivity: { type: 'number', example: 0.8 }
                }
              }
            },
            solution: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNBOUNDED'] },
                objectiveValue: { type: 'number', example: 13200 },
                iterations: { type: 'number', example: 45 },
                computationTime: { type: 'number', example: 1200 }
              }
            },
            feasibility: {
              type: 'object',
              properties: {
                technical: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                financial: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                operational: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async optimizeOperations(
    @Body() optimizationDto: OptimizationDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Running optimization for organization ${user.organizationId}`);

    try {
      const result = await this.analyticsMlService.optimizeOperations(
        user.organizationId,
        optimizationDto.objective,
        optimizationDto.constraints || []
      );

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Optimization failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Optimization failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Train/retrain ML model
   */
  @Post('models/:modelId/train')
  @ApiOperation({
    summary: 'Train ML model',
    description: 'Initiate training or retraining of a machine learning model with latest data'
  })
  @ApiParam({
    name: 'modelId',
    description: 'ID of the model to train',
    example: 'model_12345'
  })
  @ApiResponse({
    status: 202,
    description: 'Model training started',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Model training started successfully' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found'
  })
  @Roles('admin', 'manager')
  async trainModel(
    @Param('modelId') modelId: string,
    @GetUser() user: User
  ) {
    this.logger.log(`Starting model training: ${modelId} by user ${user.id}`);

    try {
      await this.analyticsMlService.trainModel(modelId);

      return {
        success: true,
        message: 'Model training started successfully'
      };
    } catch (error) {
      this.logger.error(`Model training failed: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        'Model training failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get analytics capabilities overview
   */
  @Get('capabilities')
  @ApiOperation({
    summary: 'Get analytics capabilities',
    description: 'Overview of all available analytics and ML capabilities in the platform'
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics capabilities overview',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            modelTypes: {
              type: 'array',
              items: { type: 'string' },
              example: ['TIME_SERIES', 'CLASSIFICATION', 'OPTIMIZATION', 'ANOMALY_DETECTION']
            },
            categories: {
              type: 'array',
              items: { type: 'string' },
              example: ['EMISSIONS_PREDICTION', 'ENERGY_OPTIMIZATION', 'SUPPLIER_SCORING']
            },
            capabilities: {
              type: 'object',
              properties: {
                predictions: { type: 'boolean', example: true },
                insights: { type: 'boolean', example: true },
                benchmarking: { type: 'boolean', example: true },
                optimization: { type: 'boolean', example: true },
                scenarioAnalysis: { type: 'boolean', example: true }
              }
            },
            modelCount: { type: 'number', example: 4 },
            totalPredictions: { type: 'number', example: 15847 },
            averageAccuracy: { type: 'number', example: 0.901 }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  getCapabilities() {
    this.logger.log('Fetching analytics capabilities overview');

    const models = this.analyticsMlService.listModels();
    const modelTypes = [...new Set(models.map(m => m.type))];
    const categories = [...new Set(models.map(m => m.category))];
    const averageAccuracy = models.reduce((sum, m) => sum + m.accuracy, 0) / models.length;

    return {
      success: true,
      data: {
        modelTypes,
        categories,
        capabilities: {
          predictions: true,
          insights: true,
          benchmarking: true,
          optimization: true,
          scenarioAnalysis: true
        },
        modelCount: models.length,
        totalPredictions: 15847, // Mock metric
        averageAccuracy: Number(averageAccuracy.toFixed(3))
      }
    };
  }
}