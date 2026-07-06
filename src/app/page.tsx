'use client';

import React, { useState } from 'react';
import { Gear, Plus, Cardholder } from '@phosphor-icons/react';
import { DeckImporter } from '../components/DeckImporter';
import { DeckGrid } from '../components/DeckGrid';
import { ComboSelector } from '../components/ComboSelector';
import { ComboNavigator } from '../components/ComboNavigator';
import { SettingsModal } from '../components/SettingsModal';
import { ComboGenerator } from '../components/ComboGenerator';
import { HandSelector } from '../components/HandSelector';
import { CardTooltip } from '../components/CardTooltip';
import { DeckList, ComboRoute, AISettings, ComboStep, ComboHandContext, YGOPROCardDetails } from '../types';
import { TurnPosition } from '../services/prompts';
import { ALL_COMBO_ROUTES } from '../data/combos';
import { CARD_REGISTRY } from '../data/cards';
import { findMatchingRoutes } from '../engine/comboEngine';
import { generateAICombo } from '../services/aiClient';
import { exportComboToFile, importComboFromFile } from '../services/comboIO';

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

  // Map of generated route ID to its hand context
  const [handContexts, setHandContexts] = useState<Record<string, ComboHandContext>>({});

  // Card details database state
  const [cardDetails, setCardDetails] = useState<Record<string, YGOPROCardDetails>>({});

  // Tooltip tracking state
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hand selector modal state
  const [isHandSelectorOpen, setIsHandSelectorOpen] = useState(false);

  // Save settings helper
  const handleSaveSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('yugioh_combo_settings', JSON.stringify(newSettings));
  };

  // Import deck trigger
  const handleImportDeck = (deck: DeckList) => {
    setDeckList(deck);
    setSelectedRoute(null);
    loadCardDetailsForDeck(deck);
    setView('deck');
  };

  // Helper to fetch details for all cards in a deck in chunks
  const loadCardDetailsForDeck = async (deck: DeckList) => {
    interface YGOPROApiCard {
      id: number;
      name: string;
      type: string;
      desc: string;
      atk?: number;
      def?: number;
      level?: number;
      race: string;
      attribute?: string;
      archetype?: string;
    }

    const uniqueIds = Array.from(new Set([...deck.main, ...deck.extra, ...deck.side]));
    const chunkSize = 25;
    const detailsMap: Record<string, YGOPROCardDetails> = {};
    
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      try {
        const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}`;
        const response = await fetch(url);
        if (response.ok) {
          const res = await response.json();
          res.data?.forEach((card: YGOPROApiCard) => {
            detailsMap[String(card.id)] = {
              id: String(card.id),
              name: card.name,
              type: card.type,
              desc: card.desc,
              atk: card.atk,
              def: card.def,
              level: card.level,
              race: card.race,
              attribute: card.attribute,
              archetype: card.archetype
            };
          });
        }
      } catch (e) {
        console.error('Failed to fetch card details for chunk:', chunk, e);
      }
    }
    
    setCardDetails(prev => ({ ...prev, ...detailsMap }));
  };

  const handleCardMouseEnter = (cardId: string, e: React.MouseEvent) => {
    setHoveredCardId(cardId);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleCardMouseMove = (e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleCardMouseLeave = () => {
    setHoveredCardId(null);
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
      if (cardDetails[id]) {
        nameMap[id] = cardDetails[id].name;
      } else if (CARD_REGISTRY[id]) {
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

  // Open hand selector instead of directly generating
  const handleOpenHandSelector = () => {
    setIsHandSelectorOpen(true);
  };

  // Dynamic AI combo generation solver trigger (now receives hand cards + turn position)
  const handleGenerateAI = async (handCards: string[], turnPosition: TurnPosition) => {
    if (!deckList) return;
    setIsHandSelectorOpen(false);
    setIsAiGenerating(true);
    setAiError(null);

    try {
      const cardNames = await getCardNamesForDeck(deckList);
      const generated = await generateAICombo(deckList, cardNames, settings, handCards, turnPosition);
      
      // Store hand context
      const newContext: ComboHandContext = {
        handCardIds: handCards,
        turnPosition,
        generatedAt: new Date().toISOString()
      };
      setHandContexts(prev => ({ ...prev, [generated.id]: newContext }));

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

  // Export combo file helper
  const handleExportCombo = (route: ComboRoute) => {
    const context = handContexts[route.id];
    exportComboToFile(route, context);
  };

  // Import combo file helper
  const handleImportCombo = async (file: File) => {
    try {
      const { route, handContext } = await importComboFromFile(file);
      
      // Prevent duplicate IDs in current list
      setCustomRoutes(prev => [route, ...prev.filter(r => r.id !== route.id)]);
      
      if (handContext) {
        setHandContexts(prev => ({ ...prev, [route.id]: handContext }));
      }
      
      alert(`Imported combo "${route.name}" successfully!`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      alert(`Import failed: ${err}`);
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
                onCardMouseEnter={handleCardMouseEnter}
                onCardMouseLeave={handleCardMouseLeave}
                onCardMouseMove={handleCardMouseMove}
              />
            </div>

            {/* Right Panel: Combo Selector Control Room (Col 4) */}
            <div className="lg:col-span-4">
              <ComboSelector
                matchingRoutes={getMatchingCombos()}
                onSelectRoute={handleStartCombo}
                onGenerateAI={handleOpenHandSelector}
                isAiGenerating={isAiGenerating}
                hasAiConfig={!settings.useDemo && settings.customApiKey.trim() !== ''}
                onExportRoute={handleExportCombo}
                onImportCombo={handleImportCombo}
                customRouteIds={new Set(customRoutes.map(r => r.id))}
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
            handContext={handContexts[selectedRoute.id]}
            onExport={
              new Set(customRoutes.map(r => r.id)).has(selectedRoute.id)
                ? () => handleExportCombo(selectedRoute)
                : undefined
            }
            onCardMouseEnter={handleCardMouseEnter}
            onCardMouseLeave={handleCardMouseLeave}
            onCardMouseMove={handleCardMouseMove}
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

      {/* Hand Selector Modal */}
      {deckList && (
        <HandSelector
          deck={deckList}
          isOpen={isHandSelectorOpen}
          onClose={() => setIsHandSelectorOpen(false)}
          onConfirm={handleGenerateAI}
          isGenerating={isAiGenerating}
          onCardMouseEnter={handleCardMouseEnter}
          onCardMouseLeave={handleCardMouseLeave}
          onCardMouseMove={handleCardMouseMove}
        />
      )}

      {/* Card Info Popup Tooltip */}
      <CardTooltip 
        cardId={hoveredCardId} 
        position={tooltipPosition} 
        details={hoveredCardId ? cardDetails[hoveredCardId] : undefined} 
      />
    </div>
  );
}
