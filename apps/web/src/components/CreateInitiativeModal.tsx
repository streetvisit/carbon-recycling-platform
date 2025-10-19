// components/CreateInitiativeModal.tsx - Modal form for creating new initiatives

import { useState, useEffect } from 'preact/hooks';
import { usePlannerStore } from '../stores/plannerStore';

export default function CreateInitiativeModal() {
  const { 
    showCreateModal, 
    categories,
    loading,
    error,
    setShowCreateModal,
    fetchCategories,
    createInitiative 
  } = usePlannerStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    estimatedCost: '',
    reductionTarget: {
      category: '',
      percentage: ''
    }
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (showCreateModal && categories.length === 0) {
      fetchCategories();
    }
  }, [showCreateModal]);

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('reductionTarget.')) {
      const targetField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        reductionTarget: {
          ...prev.reductionTarget,
          [targetField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Initiative name is required';
    }
    
    if (!formData.reductionTarget.category) {
      errors['reductionTarget.category'] = 'Please select a target category';
    }
    
    if (!formData.reductionTarget.percentage || parseFloat(formData.reductionTarget.percentage) <= 0) {
      errors['reductionTarget.percentage'] = 'Please enter a valid reduction percentage';
    }
    
    if (parseFloat(formData.reductionTarget.percentage) > 100) {
      errors['reductionTarget.percentage'] = 'Reduction percentage cannot exceed 100%';
    }
    
    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      errors.endDate = 'End date must be after start date';
    }
    
    if (formData.estimatedCost && parseFloat(formData.estimatedCost) < 0) {
      errors.estimatedCost = 'Cost cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
      reductionTarget: {
        category: formData.reductionTarget.category,
        percentage: parseFloat(formData.reductionTarget.percentage)
      }
    };

    await createInitiative(submitData);
    
    // Reset form on success
    if (!error) {
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        estimatedCost: '',
        reductionTarget: { category: '', percentage: '' }
      });
      setFormErrors({});
    }
  };

  const handleClose = () => {
    setShowCreateModal(false);
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      estimatedCost: '',
      reductionTarget: { category: '', percentage: '' }
    });
    setFormErrors({});
  };

  if (!showCreateModal) return null;

  return (
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div class="mt-3">
          {/* Header */}
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">
              Create New Initiative
            </h3>
            <button
              onClick={handleClose}
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} class="space-y-4">
            {/* Initiative Name */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Initiative Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  formErrors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., LED Lighting Upgrade"
              />
              {formErrors.name && (
                <p class="mt-1 text-xs text-red-600">{formErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', (e.target as HTMLTextAreaElement).value)}
                rows={3}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Brief description of the initiative..."
              />
            </div>

            {/* Target Category */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Target Category *
              </label>
              <select
                value={formData.reductionTarget.category}
                onChange={(e) => handleInputChange('reductionTarget.category', (e.target as HTMLSelectElement).value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  formErrors['reductionTarget.category'] ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select an emission category...</option>
                {categories.map((category) => (
                  <option key={category.category} value={category.category}>
                    {category.category} ({category.totalCo2e.toFixed(2)} tCO₂e)
                  </option>
                ))}
              </select>
              {formErrors['reductionTarget.category'] && (
                <p class="mt-1 text-xs text-red-600">{formErrors['reductionTarget.category']}</p>
              )}
            </div>

            {/* Reduction Percentage */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Target Reduction (%) *
              </label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={formData.reductionTarget.percentage}
                onChange={(e) => handleInputChange('reductionTarget.percentage', (e.target as HTMLInputElement).value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  formErrors['reductionTarget.percentage'] ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., 25"
              />
              {formErrors['reductionTarget.percentage'] && (
                <p class="mt-1 text-xs text-red-600">{formErrors['reductionTarget.percentage']}</p>
              )}
            </div>

            {/* Date Range */}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', (e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', (e.target as HTMLInputElement).value)}
                  class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    formErrors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {formErrors.endDate && (
                  <p class="mt-1 text-xs text-red-600">{formErrors.endDate}</p>
                )}
              </div>
            </div>

            {/* Estimated Cost */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Estimated Cost (£)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(e) => handleInputChange('estimatedCost', (e.target as HTMLInputElement).value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  formErrors.estimatedCost ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., 15000"
              />
              {formErrors.estimatedCost && (
                <p class="mt-1 text-xs text-red-600">{formErrors.estimatedCost}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Initiative'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}