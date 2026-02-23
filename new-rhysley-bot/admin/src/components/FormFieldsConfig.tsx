import React, { useState } from 'react';
import { PlusIcon, TrashIcon } from './Icons';

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'number';
  label: string;
  placeholder: string;
  required: boolean;
  enabled: boolean;
  // Optional display order for controlling position
  order?: number;
}

interface FormFieldsConfigProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export const FormFieldsConfig: React.FC<FormFieldsConfigProps> = ({ fields, onChange }) => {
  const [isAddingField, setIsAddingField] = useState(false);
  const [newField, setNewField] = useState<Partial<FormField>>({
    type: 'text',
    label: '',
    placeholder: '',
    required: false,
    enabled: true,
  });

  const inputClass =
    "w-full p-3 bg-gray-800 rounded-lg ring-1 ring-white/10 " +
    "focus:outline-none focus:ring-2 focus:ring-white/40 " +
    "placeholder-gray-400 pr-12";

  const handleAddField = () => {
    if (!newField.label?.trim()) {
      alert('Please enter a field label');
      return;
    }
    
    const fieldId = newField.label.toLowerCase().replace(/\s+/g, '_');

    // Determine next order so new fields appear after existing ones
    const nextOrderBase = fields.length > 0
      ? Math.max(
          ...fields.map((f, index) =>
            typeof f.order === 'number' ? f.order : index + 1,
          ),
        )
      : 0;

    const field: FormField = {
      id: fieldId,
      name: fieldId,
      type: newField.type || 'text',
      label: newField.label,
      placeholder: newField.placeholder || `Enter your ${newField.label.toLowerCase()}`,
      required: newField.required || false,
      enabled: true,
      order: nextOrderBase + 1,
    };

    onChange([...fields, field]);
    setNewField({
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      enabled: true,
    });
    setIsAddingField(false);
  };

  const handleRemoveField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const handleToggleRequired = (index: number) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], required: !updated[index].required };
    onChange(updated);
  };

  const handleToggleEnabled = (index: number) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleUpdateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className="space-y-6 rounded-xl bg-slate-50/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Pre‑chat form fields</h3>
          <p className="mt-1 text-xs text-slate-300">
            Design the information you collect before a conversation starts. Toggle fields on/off instead of deleting when possible.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddingField(true)}
	    className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-semibold text-black shadow-sm hover:bg-brand-secondary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary/60 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <PlusIcon className="w-4 h-4" />
          Add field
        </button>
      </div>

      {/* Add / Edit Field Panel */}
      {isAddingField && (
        <div className="rounded-xl border border-slate-700 bg-gray-800 p-4">
          <h4 className="mb-1 text-sm font-semibold text-slate-200">Add new field</h4>
          <p className="mb-4 text-xs text-slate-400">Define a reusable field for your pre‑chat form.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400">
                  Label <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newField.label || ''}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Full name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Field type</label>
                <select
                  value={newField.type || 'text'}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value as FormField['type'] })}
                  className={inputClass}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Placeholder text</label>
                <input
                  type="text"
                  value={newField.placeholder || ''}
                  onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                  className={inputClass}
                  placeholder="Enter placeholder text"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required || false}
                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-gray-800 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-slate-300">Required field</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddingField(false);
                  setNewField({
                    type: 'text',
                    label: '',
                    placeholder: '',
                    required: false,
                    enabled: true,
                  });
                }}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddField}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-yellow-300"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Fields */}
      <div className="space-y-4">
        {[...fields]
          .sort((a, b) => {
            const aIndex = fields.findIndex(f => f.id === a.id);
            const bIndex = fields.findIndex(f => f.id === b.id);
            const aOrder = typeof a.order === 'number' ? a.order : aIndex + 1;
            const bOrder = typeof b.order === 'number' ? b.order : bIndex + 1;
            return aOrder - bOrder;
          })
          .map((field) => {
            const index = fields.findIndex(f => f.id === field.id);
            return (
          <div
            key={field.id}
            className="rounded-xl border border-slate-700 bg-gray-800 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 font-medium text-slate-200">
                    {field.label || 'Untitled field'}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-900 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                    {field.type.toUpperCase()}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      field.required
                        ? 'bg-red-900 text-red-300'
                        : 'bg-green-900 text-green-300'
                    }`}
                  >
                    {field.required ? 'Required' : 'Optional'}
                  </span>
                  {!field.enabled && (
                    <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-400">Field label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">Field type</label>
                    <select
                      value={field.type}
                      onChange={(e) => handleUpdateField(index, { type: e.target.value as FormField['type'] })}
                      className={inputClass}
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">Placeholder text</label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">Display order</label>
                    <input
                      type="number"
                      min={1}
                      value={
                        typeof field.order === 'number'
                          ? field.order
                          : index + 1
                      }
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        handleUpdateField(index, {
                          order: Number.isFinite(value) && value > 0 ? value : undefined,
                        });
                      }}
                      className={inputClass}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lower numbers appear first in the pre‑chat form.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={() => handleToggleEnabled(index)}
                      className="h-4 w-4 rounded border-slate-600 bg-gray-800 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-slate-300">Enabled</span>
                  </label>
                  
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={() => handleToggleRequired(index)}
                      disabled={!field.enabled}
                      className="h-4 w-4 rounded border-slate-600 bg-gray-800 text-brand-primary focus:ring-brand-primary disabled:opacity-40"
                    />
                    <span className="text-sm text-slate-300">Required</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveField(index)}
                className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-800 hover:text-red-400"
                title="Remove field"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
          })}
      </div>

      {/* Add New Field Modal now rendered above list */}
    </div>
  );
};

