import React, { useState } from 'react';
import { type FormField } from '../types';

export interface UserInfo {
  [key: string]: string;
}

interface UserInfoFormProps {
  onSubmit: (userInfo: UserInfo) => void;
  isLoading?: boolean;
  fields?: FormField[];
}

export const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit, isLoading = false, fields }) => {
  // Use default fields if none provided
  const defaultFields: FormField[] = [
    { id: 'name', name: 'name', type: 'text', label: 'Name', placeholder: 'Enter your name', required: true, enabled: true },
    { id: 'email', name: 'email', type: 'email', label: 'Email', placeholder: 'Enter your email', required: true, enabled: true },
    { id: 'mobile', name: 'mobile', type: 'tel', label: 'Mobile Number', placeholder: 'Enter your mobile number', required: false, enabled: true },
  ];

  const baseFields = fields || defaultFields;

  // Only sort if at least one field has an explicit order set,
  // otherwise preserve the original array order.
  const hasExplicitOrder = baseFields.some(f => typeof f.order === 'number');
  const formFields = hasExplicitOrder
    ? [...baseFields].sort((a, b) => {
        const aOrder = typeof a.order === 'number' ? a.order : 0;
        const bOrder = typeof b.order === 'number' ? b.order : 0;
        if (aOrder === bOrder) {
          return a.label.localeCompare(b.label);
        }
        return aOrder - bOrder;
      })
    : baseFields;

  const enabledFields = formFields.filter(field => field.enabled);

  const [formData, setFormData] = useState<UserInfo>(() => {
    const initialData: UserInfo = {};
    enabledFields.forEach(field => {
      initialData[field.name] = '';
    });
    return initialData;
  });
  
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    enabledFields.forEach(field => {
      if (field.type === 'tel') {
        // Default country code: India (+91)
        initial[field.name] = '+91';
      }
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: FormField, value: string, countryCode?: string): string | null => {
    if (field.required && !value.trim()) {
      return `${field.label} is required`;
    }

    if (value.trim()) {
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Please enter a valid email';
          }
          break;
        case 'tel':
          {
            const digitsOnly = value.replace(/\D/g, '');
            const code = countryCode || '+91';

            if (code === '+91') {
              // Validate as Indian mobile number.
              // Allow inputs like "9876543210", "+919876543210", or "09876543210".
              let normalized = digitsOnly;

              if (normalized.startsWith('91') && normalized.length === 12) {
                // Strip country code 91 (12 digits total -> 10-digit local)
                normalized = normalized.slice(2);
              } else if (normalized.startsWith('0') && normalized.length === 11) {
                // Strip leading 0 when length is 11 (e.g. 0XXXXXXXXXX)
                normalized = normalized.slice(1);
              }

              if (!/^[6-9]\d{9}$/.test(normalized)) {
                return 'Please enter a valid Indian mobile number';
              }
            } else {
              // Generic validation for other country codes: 7-15 digits.
              if (digitsOnly.length < 7 || digitsOnly.length > 15) {
                return 'Please enter a valid phone number';
              }
            }
          }
          break;
        case 'number':
          if (!/^\d+$/.test(value)) {
            return 'Please enter a valid number';
          }
          break;
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    enabledFields.forEach(field => {
      const error = validateField(
        field,
        formData[field.name] || '',
        field.type === 'tel' ? countryCodes[field.name] : undefined,
      );
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Filter out empty optional fields
      const submitData: UserInfo = {};
      enabledFields.forEach(field => {
        let value = formData[field.name];

        // For phone fields, submit a normalized value including the country code.
        if (field.type === 'tel') {
          const code = countryCodes[field.name] || '+91';
          const digits = (value || '').replace(/\D/g, '');
          if (digits) {
            value = `${code}${digits}`;
          } else {
            value = '';
          }
        }

        if (value && value.trim()) {
          submitData[field.name] = value;
        } else if (field.required) {
          submitData[field.name] = value;
        }
      });
      onSubmit(submitData);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent p-4 sm:p-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="relative max-w-md mx-auto rounded-2xl bg-gradient-to-br from-gray-900/90 via-gray-900 to-gray-800/95 shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/5 backdrop-blur-md transform perspective-[1200px] translate-y-0 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(0,0,0,0.75)] transition-all duration-300">
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.12)' }} />
          <div className="relative p-5 sm:p-6">
            <h2 className="text-2xl font-semibold tracking-wide text-blue-300 drop-shadow-sm mb-1">Start Chatting</h2>
            <p className="text-sm text-gray-400 mb-6">Share a few details so we can personalise your experience.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
          {enabledFields.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="block text-sm font-medium text-gray-200 mb-2 tracking-wide">
                {field.label} {field.required ? <span className="text-red-500">*</span> : <span className="text-gray-400 text-xs">(optional)</span>}
              </label>
              {field.type === 'tel' ? (
                <div className="flex gap-2">
                  <select
                    value={countryCodes[field.name] || '+91'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCountryCodes(prev => ({ ...prev, [field.name]: value }));
                    }}
                    disabled={isLoading}
                    className="px-3 py-3 rounded-xl bg-blue-50/5 text-blue-50 border border-blue-400/20 shadow-[0_8px_20px_rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/80 text-sm transition-all duration-200"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                  </select>
                  <input
                    type="tel"
                    id={field.id}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    disabled={isLoading}
                    className={`w-full px-4 py-3 rounded-xl bg-blue-50/5 text-blue-50 placeholder-blue-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.55)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 ${
                      errors[field.name]
                        ? 'focus:ring-red-500/80 border border-red-500/80'
                        : 'focus:ring-blue-500/80 border border-gray-700/80 hover:border-blue-400/60 hover:shadow-[0_14px_34px_rgba(37,99,235,0.45)]'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                </div>
              ) : (
                <input
                  type={field.type}
                  id={field.id}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-xl bg-blue-50/5 text-blue-50 placeholder-blue-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.55)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 ${
                    errors[field.name]
                      ? 'focus:ring-red-500/80 border border-red-500/80'
                      : 'focus:ring-blue-500/80 border border-gray-700/80 hover:border-blue-400/60 hover:shadow-[0_14px_34px_rgba(37,99,235,0.45)]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              )}
              {errors[field.name] && (
                <p className="text-red-400 text-sm mt-1">{errors[field.name]}</p>
              )}
            </div>
          ))}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-3 px-4 bg-sky-400 hover:bg-sky-300 text-blue-900 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_16px_36px_rgba(56,189,248,0.55)] hover:shadow-[0_20px_44px_rgba(56,189,248,0.8)]"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Chat...
              </>
            ) : (
              'Start Chat'
            )}
          </button>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
};
