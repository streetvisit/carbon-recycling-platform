// components/SupplierManagementTable.tsx - Host dashboard supplier management

import { useState, useEffect } from 'preact/hooks'
import type { SupplierWithInviteStatus } from '../../../api/src/types/suppliers'

interface SupplierManagementTableProps {
  onAddSupplier: () => void
  onInviteSupplier: (supplierId: string) => void
  onDeleteSupplier: (supplierId: string) => void
}

export default function SupplierManagementTable({ 
  onAddSupplier, 
  onInviteSupplier, 
  onDeleteSupplier 
}: SupplierManagementTableProps) {
  const [suppliers, setSuppliers] = useState<SupplierWithInviteStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/suppliers', {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers')
      }
      
      const data = await response.json()
      setSuppliers(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier? This will remove all associated data requests.')) {
      return
    }

    try {
      const response = await fetch(`/api/v1/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete supplier')
      }

      // Remove from local state
      setSuppliers(suppliers.filter(s => s.id !== supplierId))
      onDeleteSupplier(supplierId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete supplier')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800',
      pending_invite: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800'
    }
    
    const statusLabels = {
      active: 'Active',
      pending_invite: 'Pending Invite',
      inactive: 'Inactive'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses]}`}>
        {statusLabels[status as keyof typeof statusLabels]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error loading suppliers</div>
          <div className="text-gray-500 text-sm mb-4">{error}</div>
          <button 
            onClick={fetchSuppliers}
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
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Suppliers</h3>
          <button
            onClick={onAddSupplier}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Supplier
          </button>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 3a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first supplier</p>
          <div className="mt-6">
            <button
              onClick={onAddSupplier}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Supplier
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Invite
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-500">{supplier.contactEmail}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(supplier.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>{supplier.pendingRequests || 0} pending</div>
                      <div className="text-gray-500">{supplier.completedSubmissions || 0} completed</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {supplier.latestInvite ? (
                      <div>
                        {new Date(supplier.latestInvite.createdAt).toLocaleDateString()}
                        {supplier.latestInvite.isAccepted ? (
                          <div className="text-green-600 text-xs">Accepted</div>
                        ) : (
                          <div className="text-yellow-600 text-xs">Pending</div>
                        )}
                      </div>
                    ) : (
                      'Never invited'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {supplier.status !== 'active' && (
                        <button
                          onClick={() => onInviteSupplier(supplier.id)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          {supplier.status === 'pending_invite' ? 'Resend Invite' : 'Invite'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        className="text-red-600 hover:text-red-900 transition-colors ml-4"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}