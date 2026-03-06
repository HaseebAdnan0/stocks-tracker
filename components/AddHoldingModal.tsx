'use client';

import { useState, useEffect } from 'react';
import { KMI_30_SYMBOLS } from '@/lib/config';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSymbol?: string;
}

export default function AddHoldingModal({
  isOpen,
  onClose,
  onSuccess,
  initialSymbol = '',
}: AddHoldingModalProps) {
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
  const [showNonKmiWarning, setShowNonKmiWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        symbol: initialSymbol.toUpperCase() || '',
        quantity: '',
        buy_price: '',
        buy_date: '',
        broker: 'HMFS',
        notes: '',
      });
      setErrors({});
      setFilteredSymbols([]);
      setShowDropdown(false);
      setShowNonKmiWarning(false);
    }
  }, [isOpen, initialSymbol]);

  useEffect(() => {
    if (formData.symbol) {
      const filtered = KMI_30_SYMBOLS.filter((sym) =>
        sym.toLowerCase().includes(formData.symbol.toLowerCase())
      );
      setFilteredSymbols(filtered);
      setShowDropdown(filtered.length > 0);
      // Show warning if symbol is entered but not in KMI-30
      const isKmi30 = KMI_30_SYMBOLS.includes(formData.symbol.toUpperCase() as never);
      setShowNonKmiWarning(!isKmi30 && formData.symbol.length >= 2);
    } else {
      setFilteredSymbols([...KMI_30_SYMBOLS]);
      setShowDropdown(false);
      setShowNonKmiWarning(false);
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

    if (isSubmitting) return;

    const isValid = validateForm();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
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
        setErrors({ submit: errorData.error || 'Failed to add holding' });
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding holding:', err);
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
          <h2 className="text-2xl font-bold text-white">Add Holding</h2>
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
              placeholder="Enter stock symbol (e.g., LUCK, SYS)"
              autoComplete="off"
            />
            {errors.symbol && <p className="mt-1 text-sm text-red-500">{errors.symbol}</p>}
            {showNonKmiWarning && !errors.symbol && (
              <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded flex items-start gap-2">
                <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-yellow-200">This symbol is not in the KMI-30 Shariah index. You can still add it, but it may not be Shariah-compliant.</p>
              </div>
            )}

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
              {isSubmitting ? 'Adding...' : 'Add Holding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
