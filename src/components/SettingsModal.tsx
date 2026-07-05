'use client';

import React, { useState } from 'react';
import { X, Key, Cpu, ShieldCheck } from '@phosphor-icons/react';
import { AISettings, AIProvider } from '../types';
import { PROVIDER_MODELS } from '../services/aiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>(settings.provider);
  const [model, setModel] = useState<string>(settings.model);
  const [customApiKey, setCustomApiKey] = useState<string>(settings.customApiKey);
  const [useDemo, setUseDemo] = useState<boolean>(settings.useDemo);



  // Sync default model when provider changes
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProvider = e.target.value as AIProvider;
    setProvider(selectedProvider);
    const defaultModel = PROVIDER_MODELS[selectedProvider]?.[0]?.id || '';
    setModel(defaultModel);
  };

  const handleSave = () => {
    onSave({
      provider,
      model,
      customApiKey,
      useDemo
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-all duration-300 md:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-500/10 p-2 text-indigo-400">
              <Cpu size={20} weight="duotone" />
            </div>
            <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-100">
              AI Configuration
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-6 space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              API KEY ROUTING
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-900/50 p-1 border border-zinc-900">
              <button
                type="button"
                className={`rounded-md py-2 text-xs font-medium transition-all ${
                  useDemo 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => setUseDemo(true)}
              >
                Demo Mode (Free)
              </button>
              <button
                type="button"
                className={`rounded-md py-2 text-xs font-medium transition-all ${
                  !useDemo 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => setUseDemo(false)}
              >
                Custom Key Mode
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-normal">
              {useDemo 
                ? 'Uses the serverless Gemini 2.5 Flash demo keys. Subject to global rate limits.' 
                : 'Directly triggers requests from your browser to the selected LLM provider. Keys are saved strictly in LocalStorage.'}
            </p>
          </div>

          {!useDemo && (
            <>
              {/* Provider */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  AI PROVIDER
                </label>
                <select
                  value={provider}
                  onChange={handleProviderChange}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openrouter">OpenRouter / DeepSeek</option>
                </select>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  MODEL SELECTION
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {(PROVIDER_MODELS[provider] || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                    API KEY
                  </label>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>LocalStorage Only</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Key size={16} />
                  </div>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder={`Enter your ${provider.toUpperCase()} API Key`}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {useDemo && (
            <div className="rounded-lg border border-indigo-950 bg-indigo-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded bg-indigo-500/10 p-1.5 text-indigo-400 mt-0.5">
                  <ShieldCheck size={18} weight="duotone" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-zinc-200">Pre-configured Demo Mode</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    This website routes queries through a server-side proxy which runs on Google Gemini 2.5 Flash. No setup required!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-900 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
