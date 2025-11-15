'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ServiceEditModalProps {
  service?: any;
  onClose: () => void;
  onSave: () => void;
}

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper function to parse duration display to minutes
function parseDurationDisplay(durationDisplay: string): number {
  const match = durationDisplay.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 60;
}

export default function ServiceEditModal({ service, onClose, onSave }: ServiceEditModalProps) {
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    category: '',
    summary: '',
    description: '',
    duration_minutes: 60,
    duration_display: '60 min',
    price: null as number | null,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    test_pricing: false,
    enabled: true,
    display_order: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Facials', 'Advanced', 'Brows & Lashes', 'Waxing'];

  useEffect(() => {
    if (service) {
      setFormData({
        slug: service.slug || '',
        name: service.name || '',
        category: service.category || '',
        summary: service.summary || '',
        description: service.description || '',
        duration_minutes: service.duration_minutes || 60,
        duration_display: service.duration_display || `${service.duration_minutes || 60} min`,
        price: service.price != null ? Number(service.price) : null,
        buffer_before_minutes: service.buffer_before_minutes || 0,
        buffer_after_minutes: service.buffer_after_minutes || 0,
        test_pricing: service.test_pricing || false,
        enabled: service.enabled !== false,
        display_order: service.display_order || 0,
      });
      setImageUrl(service.image_url || null);
    }
  }, [service]);

  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name });
    // Auto-generate slug if slug is empty or matches the old name
    if (!formData.slug || formData.slug === generateSlug(formData.name)) {
      setFormData((prev) => ({ ...prev, slug: generateSlug(name) }));
    }
  };

  const handleDurationDisplayChange = (durationDisplay: string) => {
    const minutes = parseDurationDisplay(durationDisplay);
    setFormData({
      ...formData,
      duration_display: durationDisplay,
      duration_minutes: minutes,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError(new Error('File must be an image'));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageDelete = async () => {
    if (!service?.id || !imageUrl) return;

    try {
      setUploadingImage(true);
      const response = await fetch(`/api/admin/services/${service.id}/image`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      setImageUrl(null);
      setImagePreview(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // First, create or update the service
      const url = service
        ? `/api/admin/services/${service.id}`
        : '/api/admin/services';
      const method = service ? 'PATCH' : 'POST';

      const servicePayload = {
        slug: formData.slug,
        name: formData.name,
        category: formData.category || null,
        summary: formData.summary || null,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        duration_display: formData.duration_display || null,
        price: formData.price,
        buffer_before_minutes: formData.buffer_before_minutes,
        buffer_after_minutes: formData.buffer_after_minutes,
        test_pricing: formData.test_pricing,
        enabled: formData.enabled,
        display_order: formData.display_order,
      };

      console.log('[Service Edit] Sending request:', { url, method, servicePayload });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(servicePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save service (${response.status})`);
      }

      const responseData = await response.json();
      const serviceId = responseData.id || service?.id;

      // Upload image if a new one was selected
      if (imageFile && serviceId) {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('image', imageFile);

        const imageResponse = await fetch(`/api/admin/services/${serviceId}/image`, {
          method: 'POST',
          body: formData,
        });

        if (!imageResponse.ok) {
          throw new Error('Service saved but failed to upload image');
        }

        const imageData = await imageResponse.json();
        setImageUrl(imageData.image_url);
        setUploadingImage(false);
      }

      setSuccess(true);
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the list before closing
      await onSave();
      
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const currentImageUrl = imagePreview || imageUrl;

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">
            {service ? 'Edit Service' : 'Create Service'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <ErrorDisplay error={error} />}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Service saved successfully!
            </div>
          )}

          {service?.id && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Service ID</label>
              <input
                type="text"
                value={service.id}
                readOnly
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm bg-sand/20 font-mono text-xs cursor-not-allowed"
              />
            </div>
          )}

          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Service Image</label>
            <div className="flex items-start gap-4">
              {currentImageUrl && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImageUrl}
                    alt="Service preview"
                    className="w-32 h-32 object-cover rounded-lg border border-sand"
                  />
                  {imageUrl && !imagePreview && (
                    <button
                      type="button"
                      onClick={handleImageDelete}
                      disabled={uploadingImage}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      title="Delete image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={handleImageRemove}
                      className="absolute -top-2 -right-2 p-1 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                      title="Remove new image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-sand rounded-lg hover:bg-sand/20 transition-colors text-sm"
                >
                  <Upload className="w-4 h-4" />
                  {currentImageUrl ? 'Change Image' : 'Upload Image'}
                </button>
                {uploadingImage && (
                  <p className="text-xs text-warm-gray mt-1">Uploading image...</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage font-mono text-xs"
              placeholder="auto-generated-from-name"
            />
            <p className="text-xs text-warm-gray mt-1">URL-friendly identifier (auto-generated from name)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Summary</label>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              placeholder="Short description for service cards"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              placeholder="Full service description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Duration Display <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.duration_display}
                onChange={(e) => handleDurationDisplayChange(e.target.value)}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                placeholder="75 min"
              />
              <p className="text-xs text-warm-gray mt-1">e.g., &quot;75 min&quot;</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.duration_minutes}
                onChange={(e) => {
                  const minutes = Number(e.target.value);
                  setFormData({
                    ...formData,
                    duration_minutes: minutes,
                    duration_display: `${minutes} min`,
                  });
                }}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price ?? ''}
              onChange={(e) => setFormData({ ...formData, price: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              placeholder="150.00"
            />
            <p className="text-xs text-warm-gray mt-1">Numeric price in dollars (e.g., 150.00 for $150)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Buffer Before (minutes)</label>
              <input
                type="number"
                min="0"
                value={formData.buffer_before_minutes}
                onChange={(e) => setFormData({ ...formData, buffer_before_minutes: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
              <p className="text-xs text-warm-gray mt-1">Time buffer before service starts</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Buffer After (minutes)</label>
              <input
                type="number"
                min="0"
                value={formData.buffer_after_minutes}
                onChange={(e) => setFormData({ ...formData, buffer_after_minutes: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
              <p className="text-xs text-warm-gray mt-1">Time buffer after service ends</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="test_pricing"
                checked={formData.test_pricing}
                onChange={(e) => setFormData({ ...formData, test_pricing: e.target.checked })}
                className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
              />
              <label htmlFor="test_pricing" className="text-sm text-charcoal">
                Test Pricing
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
              />
              <label htmlFor="enabled" className="text-sm text-charcoal">
                Enabled
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Display Order</label>
            <input
              type="number"
              min="0"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
            <p className="text-xs text-warm-gray mt-1">Lower numbers appear first (0 = default)</p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-sand">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="flex-1 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || uploadingImage ? 'Saving...' : service ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
