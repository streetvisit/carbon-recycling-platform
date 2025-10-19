// components/PendingRequestsList.tsx - List of data requests for supplier portal

import { useState, useEffect } from 'preact/hooks'
import type { DataRequest } from '../../../api/src/types/suppliers'

interface PendingRequestsListProps {
  onSelectRequest: (request: DataRequest) => void
  selectedRequestId?: string
  supplierToken?: string
}

export default function PendingRequestsList({ 
  onSelectRequest, 
  selectedRequestId,
  supplierToken 
}: PendingRequestsListProps) {
  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [supplierToken])

  const fetchRequests = async () => {
    if (!supplierToken) return
    
    try {
      setLoading(true)
      const response = await fetch('/portal/api/v1/requests', {
        headers: {
          'Authorization': `Bearer ${supplierToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch data requests')
      }
      
      const data = await response.json()
      setRequests(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { class: 'bg-blue-100 text-blue-800', label: 'New' },
      in_progress: { class: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
      submitted: { class: 'bg-green-100 text-green-800', label: 'Submitted' },
      approved: { class: 'bg-gray-100 text-gray-800', label: 'Completed' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.class}`}>
        {config?.label || status}
      </span>
    )
  }

  const getPriorityColor = (dueDate?: string) => {
    if (!dueDate) return 'border-gray-200'
    
    const now = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) return 'border-red-300' // Overdue
    if (daysUntilDue <= 3) return 'border-orange-300' // Due soon
    if (daysUntilDue <= 7) return 'border-yellow-300' // Due this week
    return 'border-gray-200' // Normal
  }

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return null
    
    const now = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) {
      return <span className="text-red-600 font-medium">Overdue by {Math.abs(daysUntilDue)} days</span>
    } else if (daysUntilDue === 0) {
      return <span className="text-orange-600 font-medium">Due today</span>
    } else if (daysUntilDue === 1) {
      return <span className="text-orange-600 font-medium">Due tomorrow</span>
    } else if (daysUntilDue <= 7) {
      return <span className="text-yellow-600 font-medium">Due in {daysUntilDue} days</span>
    } else {
      return <span className="text-gray-600">Due {due.toLocaleDateString()}</span>
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error loading requests</div>
          <div className="text-gray-500 text-sm mb-4">{error}</div>
          <button 
            onClick={fetchRequests}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Data Requests</h3>
        <p className="text-sm text-gray-500 mt-1">
          {requests.filter(r => r.status !== 'approved').length} pending request{requests.filter(r => r.status !== 'approved').length !== 1 ? 's' : ''}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data requests</h3>
          <p className="mt-1 text-sm text-gray-500">You're all caught up! No pending data requests.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {requests.map((request) => (
            <div
              key={request.id}
              className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                selectedRequestId === request.id ? 'bg-blue-50' : ''
              } ${getPriorityColor(request.dueDate)}`}
              onClick={() => onSelectRequest(request)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">{request.title}</h4>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  {request.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{request.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Data Type:</span> {request.requestedDataType}
                    </div>
                    <div>
                      <span className="font-medium">Period:</span> {' '}
                      {new Date(request.periodStart).toLocaleDateString()} - {new Date(request.periodEnd).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {request.dueDate && (
                    <div className="mt-2">
                      {formatDueDate(request.dueDate)}
                    </div>
                  )}
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}