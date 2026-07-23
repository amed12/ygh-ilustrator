'use client';

import React, { useState, useEffect } from 'react';
import { Gear, Plus, Cardholder } from '@phosphor-icons/react';
import { DeckImporter } from '../components/DeckImporter';
import { DeckGrid } from '../components/DeckGrid';
import { ComboSelector } from '../components/ComboSelector';
import { ComboNavigator } from '../components/ComboNavigator';
import { SettingsModal } from '../components/SettingsModal';
import { ComboGenerator } from '../components/ComboGenerator';
import { HandSelector } from '../components/HandSelector';
import { ComboCreator } from '../components/ComboCreator';
import { ComboSheet } from '../components/ComboSheet';
import { CardTooltip } from '../components/CardTooltip';
import { DeckList, ComboRoute, AISettings, ComboStep, ComboHandContext, YGOPROCardDetails, DeckProfile, EndboardScenarioDef, EndboardScenarioId, ScenarioCatalog } from '../types';
import { TurnPosition } from '../services/prompts';
import { ALL_COMBO_ROUTES } from '../data/combos';
import { CARD_REGISTRY } from '../data/cards';
import { findMatchingRoutes, findPlayableRoutes } from '../engine/comboEngine';
import { rankRoutes } from '../engine/adaptiveMatcher';
import { generateMultipleAICombos, generateEndboardScenario } from '../services/aiClient';
import { exportComboToFile, exportPlaybookToFile, importComboFromFile } from '../services/comboIO';
import { buildShareUrl, readShareParamFromLocation, decodeShareableCombo, clearShareParamFromLocation } from '../services/shareLink';
import { ComboSolver } from '../components/ComboSolver';
import { getCachedCards, putCachedCards } from '../services/cardCache';
import { getCachedDeckProfile, putCachedDeckProfile, hashDeck } from '../services/deckProfileCache';
import { getCachedScenarioCatalog, putCachedScenarioResult, hashDeckProfileContent } from '../services/scenarioCache';
import { generateDeckProfile } from '../services/aiClient';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  customApiKey: '',
  useDemo: true
};

const SESSION_STORAGE_KEY = 'yugioh_combo_session';

interface PersistedSession {
  deckList: DeckList | null;
  customRoutes: ComboRoute[];
  handContexts: Record<string, ComboHandContext>;
  cardDetails: Record<string, YGOPROCardDetails>;
}

export default function Home() {
  // App views: 'import' | 'deck' | 'combo' | 'create-combo' | 'sheet'
  const [view, setView] = useState<'import' | 'deck' | 'combo' | 'create-combo' | 'sheet'>('import');
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
  const [comboHistory, setComboHistory] = useState<{ step: ComboStep; trigger: string }[]>([]);
  
  // AI generation loading states
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Dynamic database of generated routes (extends static routes in runtime memory)
  const [customRoutes, setCustomRoutes] = useState<ComboRoute[]>([]);

  // Map of generated route ID to its hand context
  const [handContexts, setHandContexts] = useState<Record<string, ComboHandContext>>({});

  // Card details database state
  const [cardDetails, setCardDetails] = useState<Record<string, YGOPROCardDetails>>({});

  // AI-compiled deck profile (roles + search graph) — powers the offline adaptive matcher
  const [deckProfile, setDeckProfile] = useState<DeckProfile | null>(null);
  const [isProfileGenerating, setIsProfileGenerating] = useState(false);

  // On-demand "Endboard Potential" scenarios (AI picks its own ceiling/floor hand per scenario)
  const [scenarioCatalog, setScenarioCatalog] = useState<ScenarioCatalog | null>(null);
  const [generatingScenarioId, setGeneratingScenarioId] = useState<EndboardScenarioId | null>(null);

  // Route currently being edited in the ComboCreator (null = creating a new one).
  const [editingRoute, setEditingRoute] = useState<ComboRoute | null>(null);

  // Tooltip tracking state
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hand selector modal state
  const [isHandSelectorOpen, setIsHandSelectorOpen] = useState(false);

  // Combo solver modal state
  const [isComboSolverOpen, setIsComboSolverOpen] = useState(false);
  const [solverHand, setSolverHand] = useState<string[]>([]);
  const [solverTurn, setSolverTurn] = useState<TurnPosition>('going-first');
  const [solverAiRoutes, setSolverAiRoutes] = useState<ComboRoute[]>([]);

  // Guards the write effect below from firing (and clobbering storage with empty
  // defaults) before the load effect has had a chance to restore a prior session.
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Restore the last session's deck/routes/card data on mount. Deferred to an effect
  // (rather than a useState initializer) so the first client render matches the
  // statically-prerendered HTML and only hydrates from localStorage afterward. The
  // state updates themselves are further deferred via setTimeout so they don't run
  // synchronously within the effect body (avoids the cascading-render lint/perf warning).
  useEffect(() => {
    setTimeout(() => {
      try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const session: PersistedSession = JSON.parse(stored);
          if (session.deckList) {
            setDeckList(session.deckList);
            const restoredProfile = getCachedDeckProfile(hashDeck(session.deckList));
            setDeckProfile(restoredProfile);
            if (restoredProfile) {
              setScenarioCatalog(getCachedScenarioCatalog(restoredProfile.deckHash, hashDeckProfileContent(restoredProfile)));
            }
            setView('deck');
          }
          if (session.customRoutes?.length) setCustomRoutes(session.customRoutes);
          if (session.handContexts) setHandContexts(session.handContexts);
          if (session.cardDetails) setCardDetails(session.cardDetails);
        }
      } catch (e) {
        console.error('Failed to restore saved session:', e);
      } finally {
        setIsSessionLoaded(true);
      }
    }, 0);
  }, []);

  // Tracks which route's share link was most recently copied, to flash "Copied!" feedback.
  const [justCopiedRouteId, setJustCopiedRouteId] = useState<string | null>(null);

  // Persist deck/routes/card data whenever they change, so a refresh doesn't lose them.
  // cardDetails is trimmed to the current deck's cards to avoid unbounded growth across
  // decks imported over the app's lifetime.
  useEffect(() => {
    if (!isSessionLoaded) return;
    try {
      const relevantIds = deckList
        ? new Set([...deckList.main, ...deckList.extra, ...deckList.side])
        : new Set<string>();
      const trimmedCardDetails: Record<string, YGOPROCardDetails> = {};
      relevantIds.forEach(id => {
        if (cardDetails[id]) trimmedCardDetails[id] = cardDetails[id];
      });

      const session: PersistedSession = {
        deckList,
        customRoutes,
        handContexts,
        cardDetails: trimmedCardDetails
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save session (localStorage may be full or unavailable):', e);
    }
  }, [isSessionLoaded, deckList, customRoutes, handContexts, cardDetails]);

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
    const restoredProfile = getCachedDeckProfile(hashDeck(deck));
    setDeckProfile(restoredProfile);
    setScenarioCatalog(
      restoredProfile ? getCachedScenarioCatalog(restoredProfile.deckHash, hashDeckProfileContent(restoredProfile)) : null
    );
    setView('deck');
  };

  // One-shot AI compile of card roles/search graph for the current deck — cached afterward so
  // the adaptive matcher runs fully offline until the deck composition actually changes.
  const handleAnalyzeDeckRoles = async () => {
    if (!deckList) return;
    setIsProfileGenerating(true);
    try {
      const deckHash = hashDeck(deckList);
      const profile = await generateDeckProfile(deckList, settings, cardDetails, deckHash);
      putCachedDeckProfile(profile);
      setDeckProfile(profile);
      // A fresh profile analysis may change roles/search graph — reload (or invalidate) the
      // scenario catalog rather than showing stale scenario results against the new profile.
      setScenarioCatalog(getCachedScenarioCatalog(profile.deckHash, hashDeckProfileContent(profile)));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something unexpected went wrong.';
      alert(`Couldn't analyze deck roles: ${message}`);
    } finally {
      setIsProfileGenerating(false);
    }
  };

  // On-demand generation of one Endboard Potential scenario: AI picks its own hypothetical
  // ceiling/floor hand and expands the top line through the deep-line pipeline. Structurally
  // identical to handleAnalyzeDeckRoles's loading/error pattern.
  const handleGenerateScenario = async (scenario: EndboardScenarioDef) => {
    if (!deckList || !deckProfile) return;
    setGeneratingScenarioId(scenario.id);
    try {
      const names = await getCardNamesForDeck(deckList);
      const result = await generateEndboardScenario(settings, deckList, names, cardDetails, deckProfile, scenario);
      const deckProfileVersion = hashDeckProfileContent(deckProfile);
      putCachedScenarioResult(deckProfile.deckHash, deckProfileVersion, result);
      setScenarioCatalog(getCachedScenarioCatalog(deckProfile.deckHash, deckProfileVersion));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something unexpected went wrong.';
      alert(`Couldn't generate scenario "${scenario.label}": ${message}`);
    } finally {
      setGeneratingScenarioId(null);
    }
  };

  // Opens the read-only Combo Sheet for a cached scenario result, reusing the same sheet path
  // as a normal generated route — builds a ComboHandContext with scenarioId set so ComboSheet/
  // OpeningHandPanel can label it as an AI-hypothesized hand instead of a real drawn hand.
  const handleOpenScenarioSheet = (scenarioId: EndboardScenarioId) => {
    const result = scenarioCatalog?.results[scenarioId];
    if (!result) return;
    setHandContexts(prev => ({
      ...prev,
      [result.route.id]: {
        handCardIds: result.hypotheticalHand,
        turnPosition: result.route.tags.includes('going-second') ? 'going-second' : 'going-first',
        generatedAt: result.generatedAt,
        scenarioId: result.scenarioId
      }
    }));
    handleOpenSheet(result.route);
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

    const { hits, misses } = getCachedCards(uniqueIds);
    const fetchedMap: Record<string, YGOPROCardDetails> = {};

    for (let i = 0; i < misses.length; i += chunkSize) {
      const chunk = misses.slice(i, i + chunkSize);
      try {
        const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}`;
        const response = await fetch(url);
        if (response.ok) {
          const res = await response.json();
          res.data?.forEach((card: YGOPROApiCard) => {
            fetchedMap[String(card.id)] = {
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

    if (Object.keys(fetchedMap).length) {
      putCachedCards(fetchedMap);
    }

    setCardDetails(prev => ({ ...prev, ...hits, ...fetchedMap }));
  };

  // If the URL has a #share=... fragment, decode it and load the bundled combo (and deck,
  // if the sender included one) so the recipient can open a link and start practicing
  // immediately. Runs once on mount; an explicit share link takes precedence over whatever
  // the last local session had (the session-restore effect above runs first).
  useEffect(() => {
    const shareParam = readShareParamFromLocation();
    if (!shareParam) return;

    (async () => {
      const payload = await decodeShareableCombo(shareParam);
      clearShareParamFromLocation();

      if (!payload) {
        alert('This share link appears to be invalid or corrupted.');
        return;
      }

      setCustomRoutes(prev => {
        const combined = [payload.route, ...prev];
        const unique = new Map(combined.map(r => [r.id, r]));
        return Array.from(unique.values());
      });
      if (payload.handContext) {
        setHandContexts(prev => ({ ...prev, [payload.route.id]: payload.handContext! }));
      }

      if (payload.deckList) {
        setDeckList(payload.deckList);
        loadCardDetailsForDeck(payload.deckList);
      }

      setSelectedRoute(payload.route);
      setCurrentStepId(payload.route.steps.length > 0 ? payload.route.steps[0].id : null);
      setComboHistory([]);
      setView('sheet');
    })();
  }, []);

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

  // Safety net for stuck tooltips: mouseleave never fires when the hovered card is
  // unmounted under the cursor (clicking a card in a list, closing a modal, list
  // re-render), so also clear whenever the view or a modal changes. Adjusting state
  // during render (React's "storing info from previous renders" pattern) instead of
  // in an effect avoids an extra commit just to clear this value.
  const tooltipResetKey = `${view}|${isHandSelectorOpen}|${isComboSolverOpen}|${isSettingsOpen}`;
  const [prevTooltipResetKey, setPrevTooltipResetKey] = useState(tooltipResetKey);
  if (prevTooltipResetKey !== tooltipResetKey) {
    setPrevTooltipResetKey(tooltipResetKey);
    setHoveredCardId(null);
  }

  // Find routes matching current deck (static + generated custom routes)
  const getMatchingCombos = () => {
    if (!deckList) return [];
    const matchedStatic = findMatchingRoutes(deckList, ALL_COMBO_ROUTES);
    const customMap = new Map(customRoutes.map(r => [r.id, r]));
    const uniqueCustom = Array.from(customMap.values());
    const matchedCustom = findMatchingRoutes(deckList, uniqueCustom);
    return [...matchedStatic, ...matchedCustom];
  };

  // Open the ComboCreator pre-filled from an existing route. Custom/AI routes edit in place
  // (same id); built-in routes are edited as a new copy (handled by keepId in the render below).
  const handleEditRoute = (route: ComboRoute) => {
    setEditingRoute(route);
    setView('create-combo');
  };

  // Delete a custom/AI route from the playbook (built-ins can't be deleted).
  const handleDeleteRoute = (route: ComboRoute) => {
    if (!window.confirm(`Delete "${route.name}"? This can't be undone.`)) return;
    setCustomRoutes(prev => prev.filter(r => r.id !== route.id));
    setHandContexts(prev => {
      const next = { ...prev };
      delete next[route.id];
      return next;
    });
    if (selectedRoute?.id === route.id) {
      setSelectedRoute(null);
    }
  };

  // Open the read-only Combo Sheet for a route — derived purely from selectedRoute/handContexts,
  // no new persistence needed.
  const handleOpenSheet = (route: ComboRoute) => {
    setSelectedRoute(route);
    setView('sheet');
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
  const handleAdvanceCombo = (trigger: string) => {
    if (!selectedRoute || currentStepId === null) return;
    const stepMap = new Map(selectedRoute.steps.map(s => [s.id, s]));
    const currentStep = stepMap.get(currentStepId);
    if (!currentStep) return;

    setComboHistory(prev => [...prev, { step: currentStep, trigger }]);

    const response = currentStep.responses?.find(r => r.trigger === trigger);
    const nextId = response ? response.next_step : null;
    setCurrentStepId(nextId);
  };

  // Rollback state machine to a previous step in history
  const handleStepClick = (historyIndex: number) => {
    if (!selectedRoute) return;
    const clickedItem = comboHistory[historyIndex];
    if (!clickedItem) return;

    const newHistory = comboHistory.slice(0, historyIndex);
    setComboHistory(newHistory);
    setCurrentStepId(clickedItem.step.id);
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

  // Open hand selector instead of directly generating.
  // Requires a deck profile first — the AI combo prompt leans on the role map.
  const handleOpenHandSelector = () => {
    if (!deckProfile) return;
    setIsHandSelectorOpen(true);
  };

  // Handle hand configuration confirm from HandSelector modal
  const handleConfirmHand = (handCards: string[], turnPosition: TurnPosition) => {
    setIsHandSelectorOpen(false);
    setSolverHand(handCards);
    setSolverTurn(turnPosition);
    setSolverAiRoutes([]);
    setIsComboSolverOpen(true);
    setAiError(null);
  };

  // Dynamic AI combo generation solver trigger for all possibilities
  const handleTriggerAiSolver = async () => {
    if (!deckList) return;
    setIsAiGenerating(true);
    setAiError(null);

    try {
      const cardNames = await getCardNamesForDeck(deckList);
      const generatedRoutes = await generateMultipleAICombos(
        settings,
        deckList,
        cardNames,
        solverHand,
        solverTurn,
        cardDetails,
        deckProfile ?? undefined
      );
      
      // Store hand context for all generated routes
      const newContexts: Record<string, ComboHandContext> = {};
      const now = new Date().toISOString();
      generatedRoutes.forEach(r => {
        newContexts[r.id] = {
          handCardIds: solverHand,
          turnPosition: solverTurn,
          generatedAt: now
        };
      });
      
      setHandContexts(prev => ({ ...prev, ...newContexts }));
      setSolverAiRoutes(generatedRoutes);
      
      // Also register these routes in the custom routes list so they show up in deck lists and are persistable
      setCustomRoutes(prev => [...generatedRoutes, ...prev]);
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

  // Export all accumulated custom/AI-generated combos as a single Playbook file
  const handleExportPlaybook = () => {
    if (customRoutes.length === 0) return;
    exportPlaybookToFile(customRoutes, handContexts, deckProfile ?? undefined);
  };

  // Copies a shareable link to this combo (bundling the current deck, if any) to the clipboard.
  const handleShareCombo = async (route: ComboRoute) => {
    try {
      const url = await buildShareUrl({
        version: '1.0',
        route,
        handContext: handContexts[route.id],
        deckList: deckList ?? undefined
      });
      await navigator.clipboard.writeText(url);
      setJustCopiedRouteId(route.id);
      setTimeout(() => setJustCopiedRouteId(prev => (prev === route.id ? null : prev)), 2000);
    } catch (e) {
      console.error('Failed to build/copy share link:', e);
      alert('Failed to generate a share link. Your browser may not support the required APIs.');
    }
  };

  // Import combo file helper
  const handleImportCombo = async (files: File[]) => {
    try {
      const newRoutes: ComboRoute[] = [];
      const newContexts = { ...handContexts };
      let successCount = 0;

      for (const file of files) {
        try {
          const { routes: importedItems, deckProfile: importedProfile } = await importComboFromFile(file);
          for (const item of importedItems) {
            newRoutes.push(item.route);
            if (item.handContext) {
              newContexts[item.route.id] = item.handContext;
            }
            successCount++;
          }
          if (importedProfile) {
            putCachedDeckProfile(importedProfile);
          }
        } catch (err) {
          console.error(`Import failed for ${file.name}:`, err);
        }
      }

      if (successCount === 0 && files.length > 0) {
        alert("Couldn't import any of those files. Make sure you're selecting a .json combo file exported from this app.");
        return;
      }

      // Prevent duplicate IDs in current list
      setCustomRoutes(prev => {
        const combined = [...newRoutes, ...prev];
        const unique = new Map(combined.map(r => [r.id, r]));
        return Array.from(unique.values());
      });

      setHandContexts(newContexts);

      alert(`Imported ${successCount} combo${successCount !== 1 ? 's' : ''} successfully!`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Something unexpected went wrong.';
      alert(`Couldn't import that file: ${err}`);
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
    selectedRoute ? ((selectedRoute.steps.find(s => s.id === currentStepId)?.responses?.length || 0) === 0) : true
  );

  // Required main-deck starters not present in the hand this route was practiced from — surfaced
  // as a warning banner so a "reachable via search" line is honest about what it assumes.
  const getAssumedMissingCards = (): string[] => {
    if (!selectedRoute || !deckList) return [];
    const practicedHand = handContexts[selectedRoute.id]?.handCardIds ?? solverHand;
    if (!practicedHand || practicedHand.length === 0) return [];

    const mainDeckSet = new Set(deckList.main);
    const handCounts = new Map<string, number>();
    practicedHand.forEach(id => handCounts.set(id, (handCounts.get(id) || 0) + 1));

    const reqCounts = new Map<string, number>();
    selectedRoute.requiredCards.filter(id => mainDeckSet.has(id)).forEach(id => {
      reqCounts.set(id, (reqCounts.get(id) || 0) + 1);
    });

    const missing: string[] = [];
    reqCounts.forEach((count, id) => {
      if ((handCounts.get(id) || 0) < count) missing.push(id);
    });
    return missing;
  };

  const getDominantArchetype = () => {
    if (!deckList) return '';
    const counts: Record<string, number> = {};
    const allCards = [...deckList.main, ...deckList.extra];
    allCards.forEach(id => {
      const arch = cardDetails[id]?.archetype || (
        CARD_REGISTRY[id]?.name && CARD_REGISTRY[id].name.includes(' - ')
          ? CARD_REGISTRY[id].name.split(' - ')[0]
          : undefined
      );
      if (arch) {
        counts[arch] = (counts[arch] || 0) + 1;
      }
    });

    let dominant = '';
    let maxCount = 0;
    for (const [arch, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = arch;
      }
    }
    return dominant;
  };

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
    <div className="flex flex-col min-h-screen" onClickCapture={handleCardMouseLeave}>
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
                cardDetails={cardDetails}
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
                onExportRoute={handleExportCombo}
                onEditRoute={handleEditRoute}
                onDeleteRoute={handleDeleteRoute}
                onShareRoute={handleShareCombo}
                onSheetRoute={handleOpenSheet}
                sharedRouteId={justCopiedRouteId}
                onImportCombo={handleImportCombo}
                onExportPlaybook={handleExportPlaybook}
                onCreateCombo={() => setView('create-combo')}
                customRouteIds={new Set(customRoutes.map(r => r.id))}
                deckCardIds={new Set([...deckList.main, ...deckList.extra, ...deckList.side])}
                deck={deckList}
                cardDetails={cardDetails}
                deckProfile={deckProfile}
                hasDeckProfile={!!deckProfile}
                isProfileGenerating={isProfileGenerating}
                onAnalyzeDeckRoles={
                  (settings.useDemo || settings.customApiKey.trim() !== '') ? handleAnalyzeDeckRoles : undefined
                }
                scenarioCatalog={scenarioCatalog}
                generatingScenarioId={generatingScenarioId}
                onGenerateScenario={
                  (settings.useDemo || settings.customApiKey.trim() !== '') ? handleGenerateScenario : undefined
                }
                onOpenScenarioSheet={handleOpenScenarioSheet}
                onCardMouseEnter={handleCardMouseEnter}
                onCardMouseLeave={handleCardMouseLeave}
                onCardMouseMove={handleCardMouseMove}
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
            onStepClick={handleStepClick}
            onBackToDeck={() => setView('deck')}
            handContext={handContexts[selectedRoute.id]}
            onExport={
              new Set(customRoutes.map(r => r.id)).has(selectedRoute.id)
                ? () => handleExportCombo(selectedRoute)
                : undefined
            }
            onShare={() => handleShareCombo(selectedRoute)}
            onEdit={() => handleEditRoute(selectedRoute)}
            onOpenSheet={() => handleOpenSheet(selectedRoute)}
            justCopied={justCopiedRouteId === selectedRoute.id}
            cardDetails={cardDetails}
            deckProfile={deckProfile}
            assumedMissingCards={getAssumedMissingCards()}
            onCardMouseEnter={handleCardMouseEnter}
            onCardMouseLeave={handleCardMouseLeave}
            onCardMouseMove={handleCardMouseMove}
          />
        )}

        {view === 'sheet' && selectedRoute && (
          <ComboSheet
            route={selectedRoute}
            handContext={handContexts[selectedRoute.id]}
            cardDetails={cardDetails}
            deckList={deckList ?? undefined}
            onBack={() => setView(deckList ? 'deck' : 'import')}
            onPractice={handleStartCombo}
            onCardMouseEnter={handleCardMouseEnter}
            onCardMouseLeave={handleCardMouseLeave}
            onCardMouseMove={handleCardMouseMove}
          />
        )}

        {view === 'create-combo' && deckList && (
          <ComboCreator
            deck={deckList}
            defaultArchetype={getDominantArchetype()}
            existingRoute={editingRoute ?? undefined}
            keepId={editingRoute ? new Set(customRoutes.map(r => r.id)).has(editingRoute.id) : false}
            onSave={(newRoute) => {
              // Upsert: replace the existing entry when editing in place, else prepend a new one.
              setCustomRoutes(prev =>
                prev.some(r => r.id === newRoute.id)
                  ? prev.map(r => (r.id === newRoute.id ? newRoute : r))
                  : [newRoute, ...prev]
              );
              setEditingRoute(null);
              setView('deck');
            }}
            onCancel={() => {
              setEditingRoute(null);
              setView('deck');
            }}
            cardDetails={cardDetails}
            deckProfile={deckProfile ?? undefined}
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
          onConfirm={handleConfirmHand}
          availableRoutes={getMatchingCombos()}
          onSelectCombo={(route) => {
            setIsHandSelectorOpen(false);
            handleStartCombo(route);
          }}
          isGenerating={isAiGenerating}
          cardDetails={cardDetails}
          deckProfile={deckProfile}
          onCardMouseEnter={handleCardMouseEnter}
          onCardMouseLeave={handleCardMouseLeave}
          onCardMouseMove={handleCardMouseMove}
        />
      )}

      {/* Combo Solver Modal */}
      {isComboSolverOpen && deckList && (
        <ComboSolver
          playableRoutes={findPlayableRoutes(solverHand, getMatchingCombos(), deckList)}
          reachableMatches={rankRoutes(solverHand, getMatchingCombos(), deckList, cardDetails, deckProfile ?? undefined).filter(m => m.playability !== 'direct')}
          aiRoutes={solverAiRoutes}
          handCards={solverHand}
          turnPosition={solverTurn}
          isGenerating={isAiGenerating}
          aiError={aiError}
          hasAiConfig={settings.useDemo || (settings.customApiKey.trim() !== '')}
          cardDetails={cardDetails}
          onSelectCombo={(route) => {
            setIsComboSolverOpen(false);
            handleStartCombo(route);
          }}
          onGenerateAI={handleTriggerAiSolver}
          onClose={() => setIsComboSolverOpen(false)}
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
        roles={hoveredCardId ? deckProfile?.cards[hoveredCardId]?.roles : undefined}
        searches={hoveredCardId ? deckProfile?.cards[hoveredCardId]?.searches : undefined}
        cardDetails={cardDetails}
      />
    </div>
  );
}
