import { useState } from 'preact/hooks';

interface ActivityData {
  id: string;
  value: number;
  unit: string;
  category: string;
  emissions: number;
}

interface CalculationResult {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  breakdown: ActivityData[];
}

interface CalculatorResultsExportProps {
  result: CalculationResult;
  companyName?: string;
  calculationDate?: Date;
}

export default function CalculatorResultsExport({ 
  result, 
  companyName = "Your Company", 
  calculationDate = new Date() 
}: CalculatorResultsExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const formatEmissions = (value: number): string => {
    if (value === 0) return '0.000';
    if (value < 0.001) return '<0.001';
    return value.toFixed(3);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const generateCSVData = (): string => {
    const headers = ['Category', 'Activity', 'Value', 'Unit', 'Emissions (tCO₂e)', 'Scope'];
    const rows = result.breakdown.map(item => {
      const scope = ['gas', 'diesel', 'petrol'].includes(item.id) ? 'Scope 1' :
                   ['electricity'].includes(item.id) ? 'Scope 2' : 'Scope 3';
      
      const activityName = {
        'electricity': 'Electricity Consumption',
        'gas': 'Natural Gas',
        'diesel': 'Diesel Fuel',
        'petrol': 'Petrol Fuel',
        'flights': 'Business Travel (Air)',
        'waste': 'General Waste',
        'water': 'Water Consumption',
        'commuting': 'Employee Commuting'
      }[item.id] || item.id;

      return [
        item.category,
        activityName,
        item.value.toString(),
        item.unit,
        formatEmissions(item.emissions),
        scope
      ];
    });

    // Add summary rows
    rows.push(['Summary', 'Scope 1 Total', '', '', formatEmissions(result.scope1), 'Scope 1']);
    rows.push(['Summary', 'Scope 2 Total', '', '', formatEmissions(result.scope2), 'Scope 2']);
    rows.push(['Summary', 'Scope 3 Total', '', '', formatEmissions(result.scope3), 'Scope 3']);
    rows.push(['Summary', 'TOTAL EMISSIONS', '', '', formatEmissions(result.total), 'All Scopes']);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  };

  const generateReportHTML = (): string => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Carbon Emissions Report - ${companyName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 30px; }
        .company-name { font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
        .report-title { font-size: 20px; color: #059669; margin-bottom: 5px; }
        .report-date { color: #6b7280; font-size: 14px; }
        .summary-section { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .total-emissions { font-size: 36px; font-weight: bold; color: #1f2937; text-align: center; }
        .scope-breakdown { display: flex; justify-content: space-between; margin: 20px 0; }
        .scope-card { text-align: center; padding: 15px; border-radius: 6px; flex: 1; margin: 0 10px; }
        .scope-1 { background: #fee2e2; border: 1px solid #fecaca; }
        .scope-2 { background: #fed7aa; border: 1px solid #fdba74; }
        .scope-3 { background: #cffafe; border: 1px solid #67e8f9; }
        .scope-number { font-size: 24px; font-weight: bold; }
        .scope-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: bold; }
        .methodology { background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${companyName}</div>
        <div class="report-title">Carbon Emissions Calculation Report</div>
        <div class="report-date">Generated on ${formatDate(calculationDate)}</div>
    </div>

    <div class="summary-section">
        <div class="total-emissions">${formatEmissions(result.total)} tCO₂e</div>
        <p style="text-align: center; color: #6b7280;">Total Annual Carbon Footprint</p>
        
        <div class="scope-breakdown">
            <div class="scope-card scope-1">
                <div class="scope-number">${formatEmissions(result.scope1)}</div>
                <div class="scope-label">Scope 1 Direct</div>
            </div>
            <div class="scope-card scope-2">
                <div class="scope-number">${formatEmissions(result.scope2)}</div>
                <div class="scope-label">Scope 2 Energy</div>
            </div>
            <div class="scope-card scope-3">
                <div class="scope-number">${formatEmissions(result.scope3)}</div>
                <div class="scope-label">Scope 3 Other</div>
            </div>
        </div>
    </div>

    <h3>Detailed Breakdown</h3>
    <table>
        <thead>
            <tr>
                <th>Activity</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Emissions (tCO₂e)</th>
                <th>Scope</th>
            </tr>
        </thead>
        <tbody>
            ${result.breakdown.map(item => {
              const scope = ['gas', 'diesel', 'petrol'].includes(item.id) ? 'Scope 1' :
                           ['electricity'].includes(item.id) ? 'Scope 2' : 'Scope 3';
              const activityName = {
                'electricity': 'Electricity Consumption',
                'gas': 'Natural Gas',
                'diesel': 'Diesel Fuel',
                'petrol': 'Petrol Fuel',
                'flights': 'Business Travel (Air)',
                'waste': 'General Waste',
                'water': 'Water Consumption',
                'commuting': 'Employee Commuting'
              }[item.id] || item.id;
              
              return `<tr>
                <td>${activityName}</td>
                <td>${item.value.toLocaleString()}</td>
                <td>${item.unit}</td>
                <td>${formatEmissions(item.emissions)}</td>
                <td>${scope}</td>
              </tr>`;
            }).join('')}
        </tbody>
    </table>

    <div class="methodology">
        <h3>Methodology</h3>
        <p>This carbon footprint calculation follows the GHG Protocol standards and uses UK DEFRA 2025 emission factors:</p>
        <ul>
            <li><strong>Scope 1:</strong> Direct emissions from sources owned or controlled by the organization</li>
            <li><strong>Scope 2:</strong> Indirect emissions from purchased electricity, steam, heating and cooling</li>
            <li><strong>Scope 3:</strong> All other indirect emissions in the organization's value chain</li>
        </ul>
        <p><strong>Emission Factors Used:</strong></p>
        <ul>
            <li>UK Grid Electricity: 0.193 kgCO₂e/kWh</li>
            <li>Natural Gas: 0.184 kgCO₂e/kWh</li>
            <li>Diesel: 2.687 kgCO₂e/litre</li>
            <li>Domestic Flights: 0.246 kgCO₂e/km</li>
            <li>General Waste: 0.594 kgCO₂e/tonne</li>
            <li>Water Supply & Treatment: 0.344 kgCO₂e/m³</li>
        </ul>
    </div>

    <div class="footer">
        <p>Report generated by CarbonRecycling.co.uk - UK Carbon Footprint Calculator</p>
        <p>This is an estimated calculation based on activity data provided. For certified reporting, please consult with a qualified carbon accounting professional.</p>
    </div>
</body>
</html>`;
  };

  const downloadCSV = () => {
    const csvData = generateCSVData();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `carbon-emissions-report-${companyName.replace(/\s+/g, '-').toLowerCase()}-${formatDate(calculationDate).replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadHTML = () => {
    const htmlData = generateReportHTML();
    const blob = new Blob([htmlData], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `carbon-emissions-report-${companyName.replace(/\s+/g, '-').toLowerCase()}-${formatDate(calculationDate).replace(/\//g, '-')}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    const htmlData = generateReportHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlData);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  };

  const sendEmail = async () => {
    if (!email.trim()) return;
    
    setIsExporting(true);
    
    try {
      // In a real implementation, this would call your email service
      // For now, we'll simulate the email sending
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setEmailSent(true);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSent(false);
        setEmail('');
      }, 2000);
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Export Results</h3>
          <p className="text-sm text-gray-600">Download or share your carbon footprint calculation</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{formatEmissions(result.total)} tCO₂e</div>
          <div className="text-xs text-gray-500">Total Emissions</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={downloadCSV}
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV Data
        </button>

        <button
          onClick={downloadHTML}
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          HTML Report
        </button>

        <button
          onClick={printReport}
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>

        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center justify-center px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email
        </button>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Email Report</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!emailSent ? (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Enter your email address to receive the carbon emissions report
                </p>
                <div className="mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e: Event) => setEmail((e.target as HTMLInputElement).value)}
                    placeholder="your.email@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={isExporting || !email.trim()}
                    className="flex-1 px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isExporting ? 'Sending...' : 'Send Report'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-green-600 text-4xl mb-2">✓</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Report Sent!</h4>
                <p className="text-sm text-gray-600">
                  Your carbon emissions report has been sent to {email}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Information */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Reports include detailed methodology and UK DEFRA 2025 emission factors</p>
          <p>• CSV format suitable for further analysis and custom reporting</p>
          <p>• HTML reports can be converted to PDF using your browser's print function</p>
        </div>
      </div>
    </div>
  );
}