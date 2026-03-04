'use client';

import { useState, useEffect } from 'react';
import { formatPKR, formatNumber } from '@/utils/formatters';

interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  broker: string;
  notes: string | null;
  current_price: number | null;
  change: number | null;
  change_percent: number | null;
  investment: number;
  current_value: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  indices: string[];
  status?: 'active' | 'sold';
  realized_pl?: number;
}

interface SellHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  holding: Holding | null;
}

export default function SellHoldingModal({
  isOpen,
  onClose,
  onSuccess,
  holding,
}: SellHoldingModalProps) {
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0], // Default to today
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && holding) {
      setFormData({
        quantity: '',
        price: holding.current_price?.toString() || '',
        date: new Date().toISOString().split('T')[0],
      });
      setErrors({});
    }
  }, [isOpen, holding]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const calculateSaleValue = () => {
    const qty = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    if (qty > 0 && price > 0) {
      return qty * price;
    }
    return 0;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.quantity) {
      newErrors.quantity = 'Quantity is required';
    } else if (parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    } else if (holding && parseFloat(formData.quantity) > holding.quantity) {
      newErrors.quantity = `Cannot sell more than ${holding.quantity} shares`;
    }

    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else if (parseFloat(formData.price) <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || !holding) return;

    const isValid = validateForm();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/portfolio/${holding.id}/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: parseFloat(formData.quantity),
          price: parseFloat(formData.price),
          date: formData.date,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to record sale' });
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error recording sale:', err);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen || !holding) return null;

  const saleValue = calculateSaleValue();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Sell Holding</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Holding Info Section */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Symbol:</span>
              <span className="text-white font-semibold text-lg">{holding.symbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Available Quantity:</span>
              <span className="text-white font-semibold">{formatNumber(holding.quantity)} shares</span>
            </div>
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-300 mb-2">
              Quantity to Sell *
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              min="1"
              max={holding.quantity}
              step="1"
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.quantity ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder={`Max: ${holding.quantity}`}
            />
            {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>}
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-2">
              Sale Price per Share (PKR) *
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              step="0.01"
              min="0.01"
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.price ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder="Enter sale price"
            />
            {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-2">
              Sale Date *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.date ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
            />
            {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date}</p>}
          </div>

          {/* Calculated Sale Value */}
          {saleValue > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Total Sale Value:</span>
                <span className="text-white font-bold text-lg">{formatPKR(saleValue)}</span>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded">
              <p className="text-sm text-red-200">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Recording Sale...' : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
