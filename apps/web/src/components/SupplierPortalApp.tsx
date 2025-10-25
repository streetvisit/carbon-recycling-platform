// components/SupplierPortalApp.tsx - Main supplier portal app component
import { useState, useEffect } from 'preact/hooks'
import PortalHeader from './PortalHeader'
import PendingRequestsList from './PendingRequestsList'
import DataSubmissionForm from './DataSubmissionForm'

export default function SupplierPortalApp() {
  const [supplierToken, setSupplierToken] = useState<string | null>(null)
  const [supplierInfo, setSupplierInfo] = useState<any>(null)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored authentication
    const token = localStorage.getItem('supplierToken')
    const info = localStorage.getItem('supplierInfo')

    if (token && info) {
      setSupplierToken(token)
      setSupplierInfo(JSON.parse(info))
      setIsAuthorized(true)
    } else {
      setIsAuthorized(false)
    }
    
    setLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('supplierToken')
    localStorage.removeItem('supplierInfo')
    window.location.href = '/'
  }

  const handleRequestSelect = (request: any) => {
    setSelectedRequest(request)
  }

  const handleSubmissionSuccess = () => {
    // Refresh the requests list by clearing and re-rendering
    setSelectedRequest(null)
    // Force re-render of requests list by updating a key or state
    window.location.reload()
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading portal...</p>
        </div>
      </div>
    )
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Access Required</h3>
          <p className="mt-2 text-sm text-gray-500">
            You need a valid invitation to access the supplier portal.
          </p>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Authorized - show main portal
  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        supplierName={supplierInfo?.name || 'Supplier'}
        hostCompanyName="Carbon Recycling Host Company"
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PendingRequestsList
            onSelectRequest={handleRequestSelect}
            selectedRequestId={selectedRequest?.id}
            supplierToken={supplierToken}
          />
          <DataSubmissionForm
            request={selectedRequest}
            supplierToken={supplierToken}
            onSubmitted={handleSubmissionSuccess}
          />
        </div>

        {/* Quick Help Section */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">How to Use This Portal</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-semibold text-lg">1</span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Select a Request</h4>
              <p className="text-xs text-gray-500">
                Click on any data request from the left panel to view details and requirements.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-semibold text-lg">2</span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Submit Your Data</h4>
              <p className="text-xs text-gray-500">
                Enter the requested values with proper units and any additional notes or context.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-semibold text-lg">3</span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Track Progress</h4>
              <p className="text-xs text-gray-500">
                Monitor the status of your submissions and receive feedback from the host company.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <h4 className="font-medium mb-1">Need Help?</h4>
              <p>If you have questions about any data request, you can add notes to your submission or contact your host company directly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
