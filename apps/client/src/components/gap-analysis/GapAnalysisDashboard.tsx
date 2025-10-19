import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Spin, Progress, Tag, Divider, Row, Col, Statistic, Timeline, Badge } from 'antd';
import { 
  TrophyOutlined, 
  WarningOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { gapAnalysisService } from '../../services/gap-analysis.service';
import type { GapAnalysisDashboardData } from '../../types/gap-analysis.types';

interface GapAnalysisDashboardProps {
  organizationId: string;
}

const GapAnalysisDashboard: React.FC<GapAnalysisDashboardProps> = ({ organizationId }) => {
  const [dashboardData, setDashboardData] = useState<GapAnalysisDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [organizationId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await gapAnalysisService.getDashboardData(organizationId);
      setDashboardData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load gap analysis data');
    } finally {
      setLoading(false);
    }
  };

  const runGapAnalysis = async () => {
    try {
      setAnalyzing(true);
      await gapAnalysisService.performGapAnalysis(organizationId);
      await loadDashboardData(); // Reload data after analysis
    } catch (err: any) {
      setError(err.message || 'Failed to perform gap analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: string) => {
    switch (score.toLowerCase()) {
      case 'excellent': return 'green';
      case 'good': return 'blue';
      case 'average': return 'orange';
      case 'needs_improvement': return 'red';
      case 'urgent_action': return 'red';
      default: return 'gray';
    }
  };

  const getScoreIcon = (score: string) => {
    switch (score.toLowerCase()) {
      case 'excellent': return <TrophyOutlined style={{ color: 'green' }} />;
      case 'good': return <CheckCircleOutlined style={{ color: 'blue' }} />;
      case 'average': return <ExclamationCircleOutlined style={{ color: 'orange' }} />;
      case 'needs_improvement': return <WarningOutlined style={{ color: 'red' }} />;
      case 'urgent_action': return <ExclamationCircleOutlined style={{ color: 'red' }} />;
      default: return <BarChartOutlined />;
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance.toLowerCase()) {
      case 'above_average': return 'green';
      case 'average': return 'blue';
      case 'below_average': return 'red';
      default: return 'gray';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading gap analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        action={
          <Button size="small" danger onClick={loadDashboardData}>
            Try Again
          </Button>
        }
      />
    );
  }

  if (!dashboardData?.hasAnalysis) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <RocketOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <h3>Ready to Analyze Your Emissions Performance?</h3>
          <p>
            Get comprehensive insights into how your organization compares to UK benchmarks,
            identify compliance gaps, and receive actionable recommendations.
          </p>
          <Button 
            type="primary" 
            size="large" 
            onClick={runGapAnalysis}
            loading={analyzing}
            icon={<BarChartOutlined />}
          >
            Run Your First Gap Analysis
          </Button>
        </div>
      </Card>
    );
  }

  const { data } = dashboardData;

  return (
    <div>
      {/* Overall Score Section */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={12}>
            <div style={{ textAlign: 'center' }}>
              {getScoreIcon(data.overallScore)}
              <h2 style={{ margin: '8px 0', textTransform: 'capitalize' }}>
                {data.overallScore.replace('_', ' ')}
              </h2>
              <Tag color={getScoreColor(data.overallScore)} style={{ textTransform: 'capitalize' }}>
                Overall Score
              </Tag>
            </div>
          </Col>
          <Col span={12}>
            <div>
              <p><strong>Analysis Date:</strong> {new Date(data.analysisDate).toLocaleDateString()}</p>
              <p><strong>Next Analysis:</strong> {new Date(data.nextAnalysisDate).toLocaleDateString()}</p>
              <Button type="primary" onClick={runGapAnalysis} loading={analyzing}>
                Run New Analysis
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Implementation Rate"
              value={data.metrics.implementationRate}
              suffix="%"
              valueStyle={{ color: data.metrics.implementationRate > 75 ? '#3f8600' : '#cf1322' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {data.metrics.implementedRecommendations}/{data.metrics.totalRecommendations} completed
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Compliance Rate"
              value={data.metrics.complianceRate}
              suffix="%"
              valueStyle={{ color: data.metrics.complianceRate > 75 ? '#3f8600' : '#cf1322' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {data.metrics.compliantGaps}/{data.metrics.totalComplianceGaps} compliant
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending Actions"
              value={data.metrics.pendingRecommendations}
              valueStyle={{ color: data.metrics.pendingRecommendations > 0 ? '#cf1322' : '#3f8600' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Non-Compliant"
              value={data.metrics.nonCompliantGaps}
              valueStyle={{ color: data.metrics.nonCompliantGaps > 0 ? '#cf1322' : '#3f8600' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Benchmarks */}
        <Col span={12}>
          <Card title="Benchmark Performance" style={{ height: '400px' }}>
            {data.benchmarks.map((benchmark, index) => (
              <div key={index} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>
                    {benchmark.type.replace('_', ' ').split(' ').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ')}
                  </span>
                  <Tag color={getPerformanceColor(benchmark.performance)}>
                    {benchmark.performance.replace('_', ' ')}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {benchmark.percentageDifference > 0 ? '+' : ''}{benchmark.percentageDifference.toFixed(1)}% vs benchmark
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {benchmark.context}
                </div>
                {index < data.benchmarks.length - 1 && <Divider />}
              </div>
            ))}
          </Card>
        </Col>

        {/* Urgent Actions */}
        <Col span={12}>
          <Card title="Urgent Actions Required" style={{ height: '400px' }}>
            {data.urgentActions.recommendations.length === 0 && data.urgentActions.complianceGaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}>No urgent actions required!</div>
              </div>
            ) : (
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {/* High Priority Recommendations */}
                {data.urgentActions.recommendations.map((rec, index) => (
                  <div key={`rec-${index}`} style={{ marginBottom: 12, padding: '8px', backgroundColor: '#fff2e8', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{rec.title}</span>
                      <Tag color={getPriorityColor(rec.priority)} size="small">
                        {rec.priority}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      {rec.description.substring(0, 80)}...
                    </div>
                  </div>
                ))}

                {/* High Priority Compliance Gaps */}
                {data.urgentActions.complianceGaps.map((gap, index) => (
                  <div key={`gap-${index}`} style={{ marginBottom: 12, padding: '8px', backgroundColor: '#fff1f0', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{gap.regulation}</span>
                      <Tag color={getPriorityColor(gap.priority)} size="small">
                        {gap.priority}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      {gap.gapDescription.substring(0, 80)}...
                    </div>
                    {gap.deadline && (
                      <div style={{ fontSize: 10, color: '#cf1322', marginTop: 4 }}>
                        <ClockCircleOutlined /> Due: {new Date(gap.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Progress */}
      {data.recentlyImplemented.length > 0 && (
        <Card title="Recent Progress" style={{ marginTop: 16 }}>
          <Timeline>
            {data.recentlyImplemented.map((rec, index) => (
              <Timeline.Item
                key={index}
                dot={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              >
                <div>
                  <strong>{rec.title}</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Implemented on {new Date(rec.implementedAt!).toLocaleDateString()}
                  </div>
                  {rec.implementationNotes && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {rec.implementationNotes}
                    </div>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* Quick Actions */}
      <Card title="Quick Actions" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col>
            <Button type="primary" icon={<FileTextOutlined />} href={`/gap-analysis/${organizationId}/recommendations`}>
              View All Recommendations
            </Button>
          </Col>
          <Col>
            <Button icon={<WarningOutlined />} href={`/gap-analysis/${organizationId}/compliance`}>
              Review Compliance Gaps
            </Button>
          </Col>
          <Col>
            <Button icon={<BarChartOutlined />} href={`/gap-analysis/${organizationId}/benchmarks`}>
              Detailed Benchmarks
            </Button>
          </Col>
          <Col>
            <Button icon={<ClockCircleOutlined />} href={`/gap-analysis/${organizationId}/history`}>
              Analysis History
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default GapAnalysisDashboard;