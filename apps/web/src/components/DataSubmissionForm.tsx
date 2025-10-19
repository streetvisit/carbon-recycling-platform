// components/DataSubmissionForm.tsx - Form for suppliers to submit data for a request

import { useEffect, useState } from 'preact/hooks'
import type { DataRequest } from '../../../api/src/types/suppliers'

interface DataSubmissionFormProps {
  request?: DataRequest
  supplierToken?: string
  onSubmitted?: () => void
}

export default function DataSubmissionForm({ request, supplierToken, onSubmitted }: DataSubmissionFormProps) {
  const [value, setValue] = useState<string>('')
  const [unit, setUnit] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setMessage(null)
    setValue('')
    setUnit('')
    setNotes('')
  }, [request?.id])

  if (!request) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-gray-500">
        Select a request to view details and submit data.
      </div>
    )
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setMessage(null)

    // Basic validation
    if (value.trim() === '' || isNaN(Number(value))) {
      setMessage({ type: 'error', text: 'Please enter a valid numeric value.' })
      return
    }
    if (!unit.trim()) {
      setMessage({ type: 'error', text: 'Please provide the unit.' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/portal/api/v1/requests/${request.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supplierToken}`
        },
        body: JSON.stringify({
          submittedValue: Number(value),
          submittedUnit: unit,
          notes
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Submission failed')
      }

      setMessage({ type: 'success', text: 'Submission sent successfully.' })
      if (onSubmitted) onSubmitted()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Submission failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Submit Data</h3>
        <p className="text-sm text-gray-500 mt-1">{request.title}</p>
      </div>

      <div className="px-6 py-4 space-y-4">
        {message && (
          <div className={`${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} border rounded-md p-3 text-sm`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., kWh, litres, tonnes"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional information about this data..."
          />
        </div>

        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600">
          <div><span className="font-medium">Data Type:</span> {request.requestedDataType}</div>
          <div><span className="font-medium">Period:</span> {new Date(request.periodStart).toLocaleDateString()} - {new Date(request.periodEnd).toLocaleDateString()}</div>
          {request.dueDate && (
            <div><span className="font-medium">Due:</span> {new Date(request.dueDate).toLocaleDateString()}</div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
