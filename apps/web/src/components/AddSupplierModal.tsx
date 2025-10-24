// components/AddSupplierModal.tsx - Modal for adding new suppliers

import { useState } from 'preact/hooks'
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth'

interface AddSupplierModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customApiUrl?: string
}

export default function AddSupplierModal({ isOpen, onClose, onSuccess, customApiUrl }: AddSupplierModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setErrors({})

    // Basic validation
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Supplier name is required'
    if (!formData.contactEmail.trim()) newErrors.contactEmail = 'Email is required'
    if (formData.contactEmail && !/\S+@\S+\.\S+/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const apiBaseUrl = customApiUrl || getApiBaseUrl()
    
    setLoading(true)
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/suppliers`, {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        handleAuthError(response)
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create supplier')
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create supplier' })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', contactEmail: '' })
    setErrors({})
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Add New Supplier</h3>
            <button
              onClick={() => {
                onClose()
                resetForm()
              }}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-600">{errors.submit}</div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: Event) => handleInputChange('name', (e.target as HTMLInputElement).value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="e.g., Acme Manufacturing Ltd"
              />
              {errors.name && (
                <div className="text-sm text-red-600 mt-1">{errors.name}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email *
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e: Event) => handleInputChange('contactEmail', (e.target as HTMLInputElement).value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.contactEmail ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="sustainability@acme.com"
              />
              {errors.contactEmail && (
                <div className="text-sm text-red-600 mt-1">{errors.contactEmail}</div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Next Steps:</div>
                <div>After adding the supplier, you'll be able to send them an invitation to join your supplier portal.</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                onClose()
                resetForm()
              }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                </svg>
              )}
              Add Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}