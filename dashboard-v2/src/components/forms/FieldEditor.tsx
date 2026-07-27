import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  X,
  GripVertical,
} from 'lucide-react';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';
import ConditionalLogicEditor from './ConditionalLogicEditor';
import type { ConditionalLogic } from './ConditionalLogicEditor';

export interface FormField {
  id: string;
  label: string;
  fieldKey: string;
  type: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: string[];
  width: 'full' | 'half' | 'third';
  order: number;
  stepId?: string;
  conditionalLogic?: ConditionalLogic;
}

interface Props {
  field: FormField;
  allFields: FormField[];
  index: number;
  totalFields: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (fieldId: string, data: Partial<FormField>) => void;
  onDelete: (fieldId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'third', label: 'Third Width' },
] as const;

export default function FieldEditor({
  field,
  allFields,
  index,
  totalFields,
  isExpanded,
  onToggleExpand,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [localLabel, setLocalLabel] = useState(field.label);
  const [localFieldKey, setLocalFieldKey] = useState(field.fieldKey);
  const [localPlaceholder, setLocalPlaceholder] = useState(field.placeholder || '');
  const [localDescription, setLocalDescription] = useState(field.description || '');
  const [newOption, setNewOption] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local state when field changes externally
  useEffect(() => {
    setLocalLabel(field.label);
    setLocalFieldKey(field.fieldKey);
    setLocalPlaceholder(field.placeholder || '');
    setLocalDescription(field.description || '');
  }, [field.id, field.label, field.fieldKey, field.placeholder, field.description]);

  // Auto-generate fieldKey from label
  const handleLabelChange = (val: string) => {
    setLocalLabel(val);
    // Only auto-generate if fieldKey matches the old label pattern
    const generated = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (localFieldKey === field.fieldKey || localFieldKey === field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) {
      setLocalFieldKey(generated);
    }
  };

  const saveLabel = useCallback(() => {
    onChange(field.id, { label: localLabel, fieldKey: localFieldKey });
  }, [field.id, localLabel, localFieldKey, onChange]);

  const saveFieldKey = useCallback(() => {
    onChange(field.id, { fieldKey: localFieldKey });
  }, [field.id, localFieldKey, onChange]);

  const savePlaceholder = useCallback(() => {
    onChange(field.id, { placeholder: localPlaceholder || undefined });
  }, [field.id, localPlaceholder, onChange]);

  const saveDescription = useCallback(() => {
    onChange(field.id, { description: localDescription || undefined });
  }, [field.id, localDescription, onChange]);

  const addOption = () => {
    if (!newOption.trim()) return;
    const options = [...(field.options || []), newOption.trim()];
    onChange(field.id, { options });
    setNewOption('');
  };

  const removeOption = (idx: number) => {
    const options = (field.options || []).filter((_, i) => i !== idx);
    onChange(field.id, { options: options.length > 0 ? options : undefined });
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(field.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const hasOptions = field.type === 'select' || field.type === 'multi_select' || field.type === 'radio';
  const hasConditionalTargets = allFields.filter(
    (f) => f.id !== field.id && f.stepId === field.stepId
  );

  return (
    <div
      className={`rounded-xl border transition-all ${
        isExpanded
          ? 'border-[var(--ring)] shadow-sm bg-[var(--card)]'
          : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--ring)]/40'
      }`}
    >
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          className="cursor-grab text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            <span className="text-xs text-[var(--muted-foreground)] font-mono w-5 shrink-0">
              {index + 1}.
            </span>
            <FieldTypeIcon type={field.type} size={14} />
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {field.label || 'Untitled Field'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] shrink-0">
              {getFieldTypeLabel(field.type)}
            </span>
            {field.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0">
                Required
              </span>
            )}
            {field.width !== 'full' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                {field.width === 'half' ? '½' : '⅓'}
              </span>
            )}
          </button>
        </div>

        {/* Collapsed conditional indicator */}
        {field.conditionalLogic?.enabled && (
          <span className="text-[10px] text-[var(--muted-foreground)] hidden sm:inline">conditional</span>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalFields - 1}
            className="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className={`p-1 rounded-md transition-colors ${
              confirmDelete
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50'
            }`}
            title={confirmDelete ? 'Click again to confirm delete' : 'Delete field'}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)] space-y-4 pt-3 animate-fade-in">
          {/* Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Label</label>
              <input
                value={localLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                onBlur={saveLabel}
                placeholder="Field label"
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Field Key</label>
              <input
                value={localFieldKey}
                onChange={(e) => setLocalFieldKey(e.target.value)}
                onBlur={saveFieldKey}
                placeholder="field_key"
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
          </div>

          {/* Placeholder + Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Placeholder</label>
              <input
                value={localPlaceholder}
                onChange={(e) => setLocalPlaceholder(e.target.value)}
                onBlur={savePlaceholder}
                placeholder="Placeholder text"
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Description</label>
              <input
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder="Help text for this field"
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
          </div>

          {/* Required + Width */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange(field.id, { required: e.target.checked })}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]/20"
              />
              <span className="text-sm text-[var(--foreground)]">Required</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Width:</span>
              <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                {WIDTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(field.id, { width: opt.value as FormField['width'] })}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      field.width === opt.value
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] font-medium'
                        : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                    }`}
                  >
                    {opt.label === 'Full Width' ? 'Full' : opt.label === 'Half Width' ? 'Half' : 'Third'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Options for select / multi-select / radio */}
          {hasOptions && (
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">Options</label>
              <div className="space-y-1.5 mb-2">
                {(field.options || []).map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-[var(--muted-foreground)]">{idx + 1}.</span>
                    <span className="flex-1 text-sm text-[var(--foreground)]">{opt}</span>
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-0.5 rounded hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Add option..."
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                />
                <button
                  type="button"
                  onClick={addOption}
                  disabled={!newOption.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Conditional Logic */}
          <ConditionalLogicEditor
            fields={hasConditionalTargets.map((f) => ({
              fieldKey: f.fieldKey,
              label: f.label,
              type: f.type,
              options: f.options,
            }))}
            logic={
              field.conditionalLogic || {
                enabled: false,
                sourceField: '',
                operator: 'equals',
                value: '',
              }
            }
            onChange={(logic) => onChange(field.id, { conditionalLogic: logic })}
          />
        </div>
      )}
    </div>
  );
}
