'use client';

import { useState, useEffect } from 'react';
import { KMI_30_SYMBOLS } from '@/lib/config';

interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  broker: string;
  notes: string | null;
}

interface EditHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  holding: Holding | null;
}

export default function EditHoldingModal({
  isOpen,
  onClose,
  onSuccess,
  holding,
}: EditHoldingModalProps) {
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    buy_price: '',
    buy_date: '',
    broker: 'HMFS',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (isOpen && holding) {
      setFormData({
        symbol: holding.symbol || '',
        quantity: holding.quantity?.toString() || '',
        buy_price: holding.buy_price?.toString() || '',
        buy_date: holding.buy_date || '',
        broker: holding.broker || 'HMFS',
        notes: holding.notes || '',
      });
      setErrors({});
      setFilteredSymbols([]);
      setShowDropdown(false);
    }
  }, [isOpen, holding]);

  useEffect(() => {
    if (formData.symbol) {
      const filtered = KMI_30_SYMBOLS.filter((sym) =>
        sym.toLowerCase().includes(formData.symbol.toLowerCase())
      );
      setFilteredSymbols(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredSymbols([...KMI_30_SYMBOLS]);
      setShowDropdown(false);
    }
  }, [formData.symbol]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSymbolSelect = (symbol: string) => {
    setFormData((prev) => ({ ...prev, symbol }));
    setShowDropdown(false);
    if (errors.symbol) {
      setErrors((prev) => ({ ...prev, symbol: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol) {
      newErrors.symbol = 'Symbol is required';
    } else if (!KMI_30_SYMBOLS.includes(formData.symbol.toUpperCase() as never)) {
      newErrors.symbol = 'Symbol must be from KMI-30 index';
    }

    if (!formData.quantity) {
      newErrors.quantity = 'Quantity is required';
    } else if (parseInt(formData.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.buy_price) {
      newErrors.buy_price = 'Buy price is required';
    } else if (parseFloat(formData.buy_price) <= 0) {
      newErrors.buy_price = 'Buy price must be greater than 0';
    }

    if (!formData.buy_date) {
      newErrors.buy_date = 'Buy date is required';
    }

    if (!formData.broker) {
      newErrors.broker = 'Broker is required';
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
      const response = await fetch(`/api/portfolio/${holding.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          quantity: parseInt(formData.quantity),
          buy_price: parseFloat(formData.buy_price),
          buy_date: formData.buy_date,
          broker: formData.broker,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to update holding' });
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating holding:', err);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Edit Holding</h2>
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
          <div className="relative">
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-300 mb-2">
              Symbol *
            </label>
            <input
              type="text"
              id="symbol"
              name="symbol"
              value={formData.symbol}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(filteredSymbols.length > 0 || !formData.symbol)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.symbol ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder="Type to search KMI-30 symbols"
              autoComplete="off"
            />
            {errors.symbol && <p className="mt-1 text-sm text-red-500">{errors.symbol}</p>}

            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                {filteredSymbols.length > 0 ? (
                  filteredSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => handleSymbolSelect(symbol)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-600 text-white transition-colors"
                    >
                      {symbol}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-400">No matching symbols</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-300 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              min="1"
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.quantity ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder="Enter quantity"
            />
            {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>}
          </div>

          <div>
            <label htmlFor="buy_price" className="block text-sm font-medium text-gray-300 mb-2">
              Buy Price (PKR) *
            </label>
            <input
              type="number"
              id="buy_price"
              name="buy_price"
              value={formData.buy_price}
              onChange={handleInputChange}
              step="0.01"
              min="0.01"
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.buy_price ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder="Enter buy price"
            />
            {errors.buy_price && <p className="mt-1 text-sm text-red-500">{errors.buy_price}</p>}
          </div>

          <div>
            <label htmlFor="buy_date" className="block text-sm font-medium text-gray-300 mb-2">
              Buy Date *
            </label>
            <input
              type="date"
              id="buy_date"
              name="buy_date"
              value={formData.buy_date}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.buy_date ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
            />
            {errors.buy_date && <p className="mt-1 text-sm text-red-500">{errors.buy_date}</p>}
          </div>

          <div>
            <label htmlFor="broker" className="block text-sm font-medium text-gray-300 mb-2">
              Broker *
            </label>
            <input
              type="text"
              id="broker"
              name="broker"
              value={formData.broker}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 bg-gray-700 border ${
                errors.broker ? 'border-red-500' : 'border-gray-600'
              } rounded text-white focus:outline-none focus:border-blue-500`}
              placeholder="Enter broker name"
            />
            {errors.broker && <p className="mt-1 text-sm text-red-500">{errors.broker}</p>}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="Add any notes about this holding"
            />
          </div>

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
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Holding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
