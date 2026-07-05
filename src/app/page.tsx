'use client';

import React, { useState } from 'react';
import { Gear, Plus, Cardholder } from '@phosphor-icons/react';
import { DeckImporter } from '../components/DeckImporter';
import { DeckGrid } from '../components/DeckGrid';
import { ComboSelector } from '../components/ComboSelector';
import { ComboNavigator } from '../components/ComboNavigator';
import { SettingsModal } from '../components/SettingsModal';
import { ComboGenerator } from '../components/ComboGenerator';
import { DeckList, ComboRoute, AISettings, ComboStep } from '../types';
import { ALL_COMBO_ROUTES } from '../data/combos';
import { CARD_REGISTRY } from '../data/cards';
import { findMatchingRoutes } from '../engine/comboEngine';
import { generateAICombo } from '../services/aiClient';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  customApiKey: '',
  useDemo: true
};

export default function Home() {
  // App views: 'import' | 'deck' | 'combo'
  const [view, setView] = useState<'import' | 'deck' | 'combo'>('import');
  const [deckList, setDeckList] = useState<DeckList | null>(null);
  
  // Custom API Settings
  const [settings, setSettings] = useState<AISettings>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yugioh_combo_settings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored settings:', e);
        }
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Active route practice state
  const [selectedRoute, setSelectedRoute] = useState<ComboRoute | null>(null);
  const [currentStepId, setCurrentStepId] = useState<number | null>(null);
  const [comboHistory, setComboHistory] = useState<{ step: ComboStep; outcome: 'success' | 'negated' }[]>([]);
  
  // AI generation loading states
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Dynamic database of generated routes (extends static routes in runtime memory)
  const [customRoutes, setCustomRoutes] = useState<ComboRoute[]>([]);

  // Save settings helper
  const handleSaveSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('yugioh_combo_settings', JSON.stringify(newSettings));
  };

  // Import deck trigger
  const handleImportDeck = (deck: DeckList) => {
    setDeckList(deck);
    setSelectedRoute(null);
    setView('deck');
  };

  // Find routes matching current deck (static + generated custom routes)
  const getMatchingCombos = () => {
    if (!deckList) return [];
    const pool = [...ALL_COMBO_ROUTES, ...customRoutes];
    return findMatchingRoutes(deckList, pool);
  };

  // Start practicing a route
  const handleStartCombo = (route: ComboRoute) => {
    setSelectedRoute(route);
    if (route.steps.length > 0) {
      setCurrentStepId(route.steps[0].id);
    } else {
      setCurrentStepId(null);
    }
    setComboHistory([]);
    setView('combo');
  };

  // State advance logic
  const handleAdvanceCombo = (outcome: 'success' | 'negated') => {
    if (!selectedRoute || currentStepId === null) return;
    const stepMap = new Map(selectedRoute.steps.map(s => [s.id, s]));
    const currentStep = stepMap.get(currentStepId);
    if (!currentStep) return;

    setComboHistory(prev => [...prev, { step: currentStep, outcome }]);

    const nextId = outcome === 'success' ? currentStep.next_success : currentStep.next_negated;
    setCurrentStepId(nextId);
  };

  // Reset active practice
  const handleResetCombo = () => {
    if (selectedRoute && selectedRoute.steps.length > 0) {
      setCurrentStepId(selectedRoute.steps[0].id);
    } else {
      setCurrentStepId(null);
    }
    setComboHistory([]);
  };

  // Helper to fetch missing card names from YGOPRODeck API before calling LLM
  const getCardNamesForDeck = async (deck: DeckList): Promise<Record<string, string>> => {
    const nameMap: Record<string, string> = {};
    const missingIds: string[] = [];
    const uniqueIds = Array.from(new Set([...deck.main, ...deck.extra, ...deck.side]));

    uniqueIds.forEach(id => {
      if (CARD_REGISTRY[id]) {
        nameMap[id] = CARD_REGISTRY[id].name;
      } else {
        missingIds.push(id);
      }
    });

    if (missingIds.length > 0) {
      try {
        // Query database API
        const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${missingIds.slice(0, 20).join(',')}`;
        const response = await fetch(url);
        if (response.ok) {
          const res = await response.json();
          res.data?.forEach((card: { id: number; name: string }) => {
            nameMap[String(card.id)] = card.name;
          });
        }
      } catch (e) {
        console.error('Failed to retrieve card names from YGOPRODeck:', e);
      }
    }

    // Default fallbacks
    uniqueIds.forEach(id => {
      if (!nameMap[id]) {
        nameMap[id] = `Card #${id}`;
      }
    });

    return nameMap;
  };

  // Dynamic AI combo generation solver trigger
  const handleGenerateAI = async () => {
    if (!deckList) return;
    setIsAiGenerating(true);
    setAiError(null);

    try {
      const cardNames = await getCardNamesForDeck(deckList);
      const generated = await generateAICombo(deckList, cardNames, settings);
      
      // Save in runtime memory database
      setCustomRoutes(prev => [generated, ...prev]);
      
      // Launch combo directly
      handleStartCombo(generated);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'An unexpected error occurred during AI solving.';
      setAiError(err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const getActiveStep = () => {
    if (!selectedRoute || currentStepId === null) return null;
    return selectedRoute.steps.find(s => s.id === currentStepId) || null;
  };

  const getProgress = () => {
    if (!selectedRoute) return { current: 0, total: 0 };
    const total = selectedRoute.steps.length;
    const currentIdx = selectedRoute.steps.findIndex(s => s.id === currentStepId);
    const current = currentIdx !== -1 ? currentIdx + 1 : total;
    return { current, total };
  };

  const isComboComplete = currentStepId === null || (
    selectedRoute ? (selectedRoute.steps.find(s => s.id === currentStepId)?.next_success === null && 
                     selectedRoute.steps.find(s => s.id === currentStepId)?.next_negated === null) : true
  );

  const getHighlightedCards = () => {
    if (selectedRoute) {
      return selectedRoute.requiredCards;
    }
    const matching = getMatchingCombos();
    if (matching.length > 0) {
      return matching[0].requiredCards;
    }
    return [];
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded bg-indigo-600/10 p-1.5 text-indigo-400 border border-indigo-500/20">
            <Cardholder size={18} weight="duotone" />
          </div>
          <span className="font-sans text-sm font-extrabold tracking-wider uppercase text-zinc-100">
            YGO Combo Engine
          </span>
        </div>

        <div className="flex items-center gap-3">
          {view !== 'import' && (
            <button
              onClick={() => setView('import')}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
            >
              <Plus size={14} />
              <span>New Deck</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-200 transition-all active:scale-[0.98]"
            title="Configure AI API"
          >
            <Gear size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Cockpit */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col justify-center">
        
        {view === 'import' && (
          <div className="py-8">
            <DeckImporter onImport={handleImportDeck} />
          </div>
        )}

        {view === 'deck' && deckList && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Center Panel: Visual Grid of Cards (Col 8) */}
            <div className="lg:col-span-8 space-y-4">
              <div>
                <h3 className="font-sans text-sm font-bold tracking-wider text-zinc-400 uppercase">
                  Deck List Visualizer
                </h3>
              </div>
              <DeckGrid 
                deck={deckList} 
                highlightedCards={getHighlightedCards()} 
              />
            </div>

            {/* Right Panel: Combo Selector Control Room (Col 4) */}
            <div className="lg:col-span-4">
              <ComboSelector
                matchingRoutes={getMatchingCombos()}
                onSelectRoute={handleStartCombo}
                onGenerateAI={handleGenerateAI}
                isAiGenerating={isAiGenerating}
                hasAiConfig={!settings.useDemo && settings.customApiKey.trim() !== ''}
              />
            </div>
          </div>
        )}

        {view === 'combo' && selectedRoute && (
          <ComboNavigator
            route={selectedRoute}
            currentStep={getActiveStep()}
            history={comboHistory}
            isComplete={isComboComplete}
            progress={getProgress()}
            onAdvance={handleAdvanceCombo}
            onReset={handleResetCombo}
            onBackToDeck={() => setView('deck')}
          />
        )}
      </main>

      {/* Global Config Settings Modals */}
      <SettingsModal
        key={isSettingsOpen ? 'open' : 'closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <ComboGenerator
        isGenerating={isAiGenerating}
        error={aiError}
        onClearError={() => setAiError(null)}
      />
    </div>
  );
}
