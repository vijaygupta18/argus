import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Loader2,
  Save,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { fetchConfig, updateConfig } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [editedKeys, setEditedKeys] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    data: config,
    isLoading,
    error,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['config'],
    queryFn: fetchConfig,
  });

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setEditedKeys({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleEdit = (key: string, value: string) => {
    if (!isAdmin) return;
    setEditedKeys((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!isAdmin) return;
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(editedKeys)) {
      try {
        payload[key] = JSON.parse(value);
      } catch {
        payload[key] = value;
      }
    }
    mutation.mutate(payload);
  };

  const hasChanges = Object.keys(editedKeys).length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64 text-red-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          Failed to load configuration
        </div>
      </div>
    );
  }

  const configEntries = config ? Object.entries(config) : [];

  // Group known keys for better presentation
  const aiKeys = configEntries.filter(([k]) =>
    k.toLowerCase().includes('ai') || k.toLowerCase().includes('provider') || k.toLowerCase().includes('model')
  );
  const reminderKeys = configEntries.filter(([k]) =>
    k.toLowerCase().includes('reminder') || k.toLowerCase().includes('frequency')
  );
  const otherKeys = configEntries.filter(
    ([k]) =>
      !aiKeys.find(([ak]) => ak === k) &&
      !reminderKeys.find(([rk]) => rk === k)
  );

  function renderConfigSection(
    title: string,
    description: string,
    entries: [string, unknown][]
  ) {
    if (entries.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {entries.map(([key, value]) => {
            const stringValue =
              typeof value === 'string' ? value : JSON.stringify(value, null, 2);
            const editedValue = editedKeys[key];
            const currentValue = editedValue !== undefined ? editedValue : stringValue;
            const isEdited = editedValue !== undefined;

            return (
              <div key={key} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {key}
                      {isEdited && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">(modified)</span>
                      )}
                    </label>
                    {typeof value === 'boolean' ? (
                      <select
                        value={currentValue}
                        onChange={(e) => handleEdit(key, e.target.value)}
                        disabled={!isAdmin}
                        className={`px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                          !isAdmin ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                        }`}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : typeof value === 'object' && value !== null ? (
                      <textarea
                        value={currentValue}
                        onChange={(e) => handleEdit(key, e.target.value)}
                        readOnly={!isAdmin}
                        rows={4}
                        className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          !isAdmin ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                        }`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleEdit(key, e.target.value)}
                        readOnly={!isAdmin}
                        className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          !isAdmin ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                        }`}
                      />
                    )}
                  </div>
                  {isEdited && isAdmin && (
                    <button
                      onClick={() => {
                        setEditedKeys((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                      className="mt-6 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="Reset to original value"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
            Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Application configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <Lock className="w-4 h-4" />
              View only
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          )}
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || mutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          Failed to save configuration. Please try again.
        </div>
      )}

      <div className="space-y-6">
        {renderConfigSection(
          'AI Provider Settings',
          'Configure AI providers for categorization and root cause analysis',
          aiKeys
        )}
        {renderConfigSection(
          'Reminder Settings',
          'Configure reminder frequency and notification settings',
          reminderKeys
        )}
        {renderConfigSection(
          'General Settings',
          'Other application configuration',
          otherKeys
        )}

        {configEntries.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Settings className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No configuration available</p>
          </div>
        )}
      </div>
    </div>
  );
}
