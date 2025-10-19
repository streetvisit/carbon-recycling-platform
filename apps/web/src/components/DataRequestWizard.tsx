// components/DataRequestWizard.tsx - Multi-step wizard for creating data requests

import { useState, useEffect } from 'preact/hooks'
import type { SupplierWithInviteStatus } from '../../../api/src/types/suppliers'
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth'

interface DataType {
  value: string
  label: string
  description: string
  expectedUnits: string[]
}

interface DataRequestWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customApiUrl?: string
}

export default function DataRequestWizard({ isOpen, onClose, onSuccess, customApiUrl }: DataRequestWizardProps) {
  const [step, setStep] = useState(1)
  const [suppliers, setSuppliers] = useState<SupplierWithInviteStatus[]>([])
  const [dataTypes, setDataTypes] = useState<DataType[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    supplierId: '',
    title: '',
    description: '',
    requestedDataType: '',
    periodStart: '',
    periodEnd: '',
    dueDate: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchDataTypes()
    }
  }, [isOpen])

  const fetchSuppliers = async () => {
    const apiBaseUrl = customApiUrl || getApiBaseUrl()
    
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/suppliers`)
      
      if (!response.ok) {
        handleAuthError(response)
        throw new Error('Failed to fetch suppliers')
      }
      
      const data = await response.json()
      setSuppliers(data.data.filter((s: SupplierWithInviteStatus) => s.status === 'active'))
    } catch (error) {
      console.error('Failed to fetch suppliers:', error)
    }
  }

  const fetchDataTypes = async () => {
    const apiBaseUrl = customApiUrl || getApiBaseUrl()
    
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/data-types`)
      
      if (!response.ok) {
        handleAuthError(response)
        throw new Error('Failed to fetch data types')
      }
      
      const data = await response.json()
      setDataTypes(data.data)
    } catch (error) {
      console.error('Failed to fetch data types:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handlePrev = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    const apiBaseUrl = customApiUrl || getApiBaseUrl()
    
    setLoading(true)
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/data-requests`, {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        handleAuthError(response)
        throw new Error('Failed to create data request')
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create data request')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setFormData({
      supplierId: '',
      title: '',
      description: '',
      requestedDataType: '',
      periodStart: '',
      periodEnd: '',
      dueDate: ''
    })
  }

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.supplierId && formData.title
      case 2:
        return formData.requestedDataType && formData.periodStart && formData.periodEnd
      case 3:
        return true // All fields on final step are optional
      default:
        return false
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === formData.supplierId)
  const selectedDataType = dataTypes.find(dt => dt.value === formData.requestedDataType)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Create Data Request</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-4">
            <div className="flex items-center">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step >= stepNum 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div className={`w-12 h-1 ${
                      step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Supplier & Title</span>
              <span>Data Type & Period</span>
              <span>Review & Submit</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-96">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Supplier *
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => handleInputChange('supplierId', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a supplier...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.contactEmail})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Q3 2024 Electricity Usage Data"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Additional context or instructions for the supplier..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Type *
                </label>
                <select
                  value={formData.requestedDataType}
                  onChange={(e) => handleInputChange('requestedDataType', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select data type...</option>
                  {dataTypes.map(dataType => (
                    <option key={dataType.value} value={dataType.value}>
                      {dataType.label}
                    </option>
                  ))}
                </select>
                {selectedDataType && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">{selectedDataType.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Expected units: {selectedDataType.expectedUnits.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => handleInputChange('periodStart', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period End *
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => handleInputChange('periodEnd', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Review Request</h4>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Supplier</div>
                  <div className="text-sm text-gray-900">{selectedSupplier?.name}</div>
                  <div className="text-xs text-gray-500">{selectedSupplier?.contactEmail}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700">Request</div>
                  <div className="text-sm text-gray-900">{formData.title}</div>
                  {formData.description && (
                    <div className="text-xs text-gray-500">{formData.description}</div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700">Data Type</div>
                  <div className="text-sm text-gray-900">{selectedDataType?.label}</div>
                  <div className="text-xs text-gray-500">{selectedDataType?.description}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700">Period</div>
                  <div className="text-sm text-gray-900">
                    {new Date(formData.periodStart).toLocaleDateString()} - {new Date(formData.periodEnd).toLocaleDateString()}
                  </div>
                </div>

                {formData.dueDate && (
                  <div>
                    <div className="text-sm font-medium text-gray-700">Due Date</div>
                    <div className="text-sm text-gray-900">{new Date(formData.dueDate).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={handlePrev}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                  </svg>
                )}
                Send Request
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}