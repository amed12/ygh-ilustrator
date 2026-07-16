'use client';

import React, { useState, useMemo } from 'react';
import { DeckList, ComboRoute, ComboStep, ComboResponse, DeckProfile, YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { CardDisplay } from './CardDisplay';
import { CardRoleBadge } from './CardRoleBadge';
import { X, Plus, Trash, ArrowLeft, FloppyDisk, DownloadSimple, CaretUp, CaretDown } from '@phosphor-icons/react';
import { exportComboToFile } from '../services/comboIO';

interface ComboCreatorProps {
  deck: DeckList;
  defaultArchetype?: string;
  onSave: (route: ComboRoute) => void;
  onCancel: () => void;
  cardDetails?: Record<string, YGOPROCardDetails>;
  deckProfile?: DeckProfile;
  /** When set, the builder opens in edit mode pre-filled from this route. */
  existingRoute?: ComboRoute;
  /** When editing, whether to save under the same id (custom/AI routes) or mint a new one (a copy of a built-in). */
  keepId?: boolean;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function ComboCreator({
  deck,
  defaultArchetype = '',
  onSave,
  onCancel,
  cardDetails = {},
  deckProfile,
  existingRoute,
  keepId = false,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: ComboCreatorProps) {
  const isEditing = !!existingRoute;

  const [activeTab, setActiveTab] = useState<'info' | 'steps' | 'endboard'>('info');

  // Basic Info State — seeded from existingRoute when editing.
  const [name, setName] = useState(() => existingRoute?.name ?? '');
  const [archetype, setArchetype] = useState(() => existingRoute?.archetype ?? defaultArchetype ?? '');
  const [description, setDescription] = useState(() => existingRoute?.description ?? '');
  const [tags, setTags] = useState<string[]>(() => existingRoute?.tags ?? ['going-first']);
  const [tagInput, setTagInput] = useState('');

  // Required Starters
  const [requiredCards, setRequiredCards] = useState<string[]>(() => existingRoute?.requiredCards ?? []);

  // Steps State — keep full step objects (incl. stateMutations) when editing so nothing is lost.
  const [steps, setSteps] = useState<ComboStep[]>(() =>
    existingRoute && existingRoute.steps.length > 0
      ? existingRoute.steps.map(s => ({
          ...s,
          responses: s.responses ?? [{ trigger: 'success', next_step: null }]
        }))
      : [
          {
            id: 1,
            action: '',
            cardId: 'NONE',
            responses: [{ trigger: 'success', next_step: null }]
          }
        ]
  );

  // End Board State
  const [endBoardMonsters, setEndBoardMonsters] = useState<string[]>(() => existingRoute?.endBoard?.monsters ?? []);
  const [endBoardSpellsTraps, setEndBoardSpellsTraps] = useState<string[]>(() => existingRoute?.endBoard?.spellsTraps ?? []);
  const [interruptions, setInterruptions] = useState<string[]>(() => existingRoute?.endBoard?.interruptions ?? []);
  const [interruptionInput, setInterruptionInput] = useState('');

  // Visual Card Picker Modal State
  const [pickerStepId, setPickerStepId] = useState<number | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Group deck cards for starters selector (Main deck only since starters must be in hand)
  const mainDeckEntries = useMemo(() => {
    const countMap = new Map<string, number>();
    deck.main.forEach(id => {
      countMap.set(id, (countMap.get(id) || 0) + 1);
    });
    return Array.from(countMap.entries()).map(([id, deckCount]) => ({
      id,
      deckCount,
      name: CARD_REGISTRY[id]?.name || `Card #${id}`
    }));
  }, [deck.main]);

  // Deduplicated deck cards for step & endboard dropdowns/lists
  const allUniqueDeckCards = useMemo(() => {
    const ids = Array.from(new Set([...deck.main, ...deck.extra]));
    return ids.map(id => ({
      id,
      name: cardDetails[id]?.name || CARD_REGISTRY[id]?.name || `Card #${id}`,
      isExtra: deck.extra.includes(id)
    }));
  }, [deck, cardDetails]);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // Toggle required card starter (matches HandSelector logic supporting duplicate counts)
  const toggleRequiredCard = (cardId: string) => {
    setRequiredCards(prev => {
      const currentCount = prev.filter(id => id === cardId).length;
      const maxCopies = deck.main.filter(id => id === cardId).length;

      if (currentCount >= maxCopies) {
        // Remove one copy
        const idx = prev.indexOf(cardId);
        if (idx !== -1) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return prev;
      }
      // Add one copy
      return [...prev, cardId];
    });
  };

  const getRequiredCardCount = (cardId: string) => {
    return requiredCards.filter(id => id === cardId).length;
  };

  // Step Management
  const addStep = () => {
    const nextId = steps.length > 0 ? Math.max(...steps.map(s => s.id)) + 1 : 1;
    setSteps([
      ...steps,
      {
        id: nextId,
        action: '',
        cardId: 'NONE',
        responses: [{ trigger: 'success', next_step: null }]
      }
    ]);
  };

  const removeStep = (id: number) => {
    // Drop the step and scrub any branch pointers in the remaining steps that referenced it,
    // so we never leave a dangling next_step pointing at a step that no longer exists.
    setSteps(steps
      .filter(s => s.id !== id)
      .map(s => s.responses
        ? { ...s, responses: s.responses.map(r => r.next_step === id ? { ...r, next_step: null } : r) }
        : s
      ));
  };

  // Reorder a step by swapping its array position with its neighbour. IDs stay fixed (they are
  // stable labels that next_step pointers reference), so only the displayed order changes.
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
  };

  const updateStepField = <K extends keyof ComboStep>(id: number, field: K, value: ComboStep[K]) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addResponse = (stepId: number) => {
    setSteps(steps.map(s => {
      if (s.id === stepId) {
        const currentResponses = s.responses || [];
        return {
          ...s,
          responses: [...currentResponses, { trigger: 'maxx_c', next_step: null }]
        };
      }
      return s;
    }));
  };

  const removeResponse = (stepId: number, index: number) => {
    setSteps(steps.map(s => {
      if (s.id === stepId && s.responses) {
        return {
          ...s,
          responses: s.responses.filter((_, i) => i !== index)
        };
      }
      return s;
    }));
  };

  const updateResponse = <K extends keyof ComboResponse>(stepId: number, resIndex: number, field: K, value: ComboResponse[K]) => {
    setSteps(steps.map(s => {
      if (s.id === stepId && s.responses) {
        const newResponses = [...s.responses];
        newResponses[resIndex] = {
          ...newResponses[resIndex],
          [field]: value
        };
        return { ...s, responses: newResponses };
      }
      return s;
    }));
  };

  // End Board togglers
  const toggleEndBoardMonster = (cardId: string) => {
    setEndBoardMonsters(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const toggleEndBoardSpellTrap = (cardId: string) => {
    setEndBoardSpellsTraps(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const addInterruption = () => {
    if (interruptionInput.trim()) {
      setInterruptions([...interruptions, interruptionInput.trim()]);
      setInterruptionInput('');
    }
  };

  const removeInterruption = (index: number) => {
    setInterruptions(interruptions.filter((_, i) => i !== index));
  };

  const handleExport = () => {
    // Use the canonical envelope exporter so the file round-trips through the importer.
    exportComboToFile(buildRouteObject());
  };

  const buildRouteObject = (): ComboRoute => {
    return {
      // Keep the id when editing a custom/AI route; mint a new one when creating or copying a built-in.
      id: existingRoute && keepId ? existingRoute.id : `custom-combo-${Date.now()}`,
      name: name.trim() || 'Untitled Custom Combo',
      archetype: archetype.trim() || 'Custom Playbook',
      description: description.trim() || 'Manually created custom combo playbook.',
      requiredCards,
      steps: steps.map(s => ({
        id: s.id,
        action: s.action.trim(),
        cardId: s.cardId,
        responses: s.responses,
        // Preserve simulator state mutations the UI can't edit (e.g. from AI-generated combos).
        ...(s.stateMutations ? { stateMutations: s.stateMutations } : {})
      })),
      tags,
      endBoard: {
        monsters: endBoardMonsters,
        spellsTraps: endBoardSpellsTraps,
        interruptions,
        // Carry through end-board tactical role labels the UI can't edit yet.
        ...(existingRoute?.endBoard?.cardRoles ? { cardRoles: existingRoute.endBoard.cardRoles } : {})
      },
      // Carry through the AI's efficiency self-assessment if present.
      ...(existingRoute?.efficiency ? { efficiency: existingRoute.efficiency } : {})
    };
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please provide a name for this custom combo.');
      return;
    }
    // At least one step must have a real action.
    const actionedSteps = steps.filter(s => s.action.trim());
    if (actionedSteps.length === 0) {
      alert('Add at least one step with an action describing what to do.');
      return;
    }
    // Any step that has an action must also have a card assigned.
    const unassigned = actionedSteps.filter(s => !s.cardId || s.cardId.toUpperCase() === 'NONE');
    if (unassigned.length > 0) {
      alert('Some steps have an action but no card assigned. Pick a card for each step (or use TOKEN/OPPONENT for generic actions).');
      setActiveTab('steps');
      return;
    }
    const route = buildRouteObject();
    onSave(route);
  };

  const getCardName = (cardId: string) => {
    if (cardId === 'NONE') return 'NONE / GENERAL ACTION';
    if (cardId === 'TOKEN') return 'TOKEN';
    if (cardId === 'OPPONENT') return 'OPPONENT ACTION';
    return CARD_REGISTRY[cardId]?.name || `Card #${cardId}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="space-y-1">
          <button
            onClick={onCancel}
            className="group flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Cancel & Back</span>
          </button>
          <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-100 mt-1">
            {isEditing ? (keepId ? 'Edit Combo' : 'Edit a Copy') : 'Manual Combo Builder'}
          </h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            {isEditing
              ? (keepId ? 'Editing this combo in place' : 'Saving will create a new editable copy')
              : 'Create custom branching lines & export them to JSON'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
          >
            <DownloadSimple size={14} />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
          >
            <FloppyDisk size={14} />
            <span>{isEditing ? 'Save Changes' : 'Save to Playbook'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900">
        {(['info', 'steps', 'endboard'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 -mb-[2px] transition-all ${
              activeTab === tab 
                ? 'border-indigo-500 text-indigo-400 font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'info' ? '1. Combo Info & Starters' : tab === 'steps' ? '2. Playbook Steps' : '3. Final End Board'}
          </button>
        ))}
      </div>

      {/* Tab Content 1: Basic Info & Starters */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Basic Information</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Combo Name</label>
                <input
                  type="text"
                  placeholder="e.g. Wise Strix Extension Route"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Archetype</label>
                <input
                  type="text"
                  placeholder="e.g. Raidraptor"
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Description / Goal</label>
                <textarea
                  placeholder="Summarize the ultimate end board or recovery goals of this route..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[9px] font-mono uppercase bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-zinc-400">
                      {tag}
                      <button type="button" onClick={() => removeTag(i)} className="hover:text-red-400 text-zinc-600">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag (e.g. otk, defensive)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-350 rounded text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Starters Grid Selector (Matches HandSelector Card Picker) */}
          <div className="lg:col-span-6 rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4 flex flex-col max-h-[500px]">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex justify-between items-center">
                <span>Required Starters</span>
                <span className="text-[10px] font-mono text-zinc-500 font-normal">
                  {requiredCards.length} Selected
                </span>
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">Click cards below to toggle them as required starters for the opening hand.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto border border-zinc-900 rounded p-3 bg-zinc-950/60 custom-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-2">
                {mainDeckEntries.map((entry) => {
                  const selectedCount = getRequiredCardCount(entry.id);
                  const isSelected = selectedCount > 0;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleRequiredCard(entry.id)}
                      className={`relative cursor-pointer rounded-lg transition-all ${
                        isSelected
                          ? 'ring-2 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                          : 'hover:ring-1 hover:ring-zinc-705'
                      }`}
                    >
                      <CardDisplay
                        cardId={entry.id}
                        size="sm"
                        glow={isSelected}
                        details={cardDetails[entry.id]}
                        onMouseEnter={onCardMouseEnter}
                        onMouseLeave={onCardMouseLeave}
                        onMouseMove={onCardMouseMove}
                      />

                      {/* Deck-analysis role chips */}
                      {deckProfile?.cards[entry.id]?.roles?.length ? (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                          {deckProfile.cards[entry.id].roles.map(role => (
                            <CardRoleBadge key={role} role={role} size="xs" />
                          ))}
                        </div>
                      ) : null}

                      {/* Selection badge */}
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-950 text-[9px] font-bold text-white shadow-lg">
                          {selectedCount}
                        </span>
                      )}

                      {/* Deck count indicator */}
                      {entry.deckCount > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 z-10 rounded bg-zinc-900/90 border border-zinc-800 px-1 py-[1px] text-[8px] font-mono text-zinc-400">
                          ×{entry.deckCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Steps Editor */}
      {activeTab === 'steps' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
            <div className="space-y-0.5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Playbook Branching Nodes</h3>
              <p className="text-[10px] text-zinc-500">Each step represents a play. Define fallback triggers pointing to recovery steps.</p>
            </div>
            <button
              onClick={addStep}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              <Plus size={12} />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {steps.map((step, index) => (
              <div key={step.id} className="relative rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4">
                {/* Step ID Header */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                      {step.id}
                    </span>
                    <span className="text-xs font-bold text-zinc-200">Play node</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-600 p-1 transition-colors"
                      title="Move step up"
                    >
                      <CaretUp size={14} />
                    </button>
                    <button
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-600 p-1 transition-colors"
                      title="Move step down"
                    >
                      <CaretDown size={14} />
                    </button>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Delete step node"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                {/* Grid Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Action instruction */}
                  <div className="md:col-span-8">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Action Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Special Summon Tribute Lanius and activate effect..."
                      value={step.action}
                      onChange={(e) => updateStepField(step.id, 'action', e.target.value)}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Card Reference Selector (Visual Overlay Trigger) */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase">Associated Card</label>
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={() => setPickerStepId(step.id)} 
                        className="cursor-pointer shrink-0 border border-zinc-800 rounded overflow-hidden hover:border-zinc-700 bg-zinc-900 transition-colors"
                      >
                        <CardDisplay
                          cardId={step.cardId}
                          size="xs"
                          details={cardDetails[step.cardId]}
                          onMouseEnter={onCardMouseEnter}
                          onMouseLeave={onCardMouseLeave}
                          onMouseMove={onCardMouseMove}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerStepId(step.id)}
                        className="flex-1 text-left text-xs bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 rounded px-3 py-2.5 text-zinc-300 flex items-center justify-between transition-colors active:scale-[0.98]"
                      >
                        <span className="truncate max-w-[120px] font-medium">{getCardName(step.cardId)}</span>
                        <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase shrink-0">Change</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Responses & Branching */}
                <div className="space-y-2 border-t border-zinc-900/60 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Branching Responses ({step.responses?.length || 0})</span>
                    <button
                      type="button"
                      onClick={() => addResponse(step.id)}
                      className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <Plus size={10} /> Add Branch Trigger
                    </button>
                  </div>

                  <div className="space-y-2">
                    {step.responses?.map((res, resIdx) => (
                      <div key={resIdx} className="flex flex-wrap items-center gap-3 bg-zinc-900/40 border border-zinc-900 p-2 rounded">
                        {/* Trigger Type selection */}
                        <div className="flex-1 min-w-[120px]">
                          <select
                            value={res.trigger}
                            onChange={(e) => updateResponse(step.id, resIdx, 'trigger', e.target.value)}
                            className="w-full text-[11px] bg-zinc-900 border border-zinc-850 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="success">Success</option>
                            <option value="maxx_c">Maxx C</option>
                            <option value="ash_blossom">Ash Blossom</option>
                            <option value="nibiru">Nibiru</option>
                            <option value="imperm_veiler">Imperm / Veiler</option>
                            <option value="generic_negate">Generic Negate</option>
                          </select>
                        </div>

                        {/* Pointer input */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">Goes to Step:</span>
                          <select
                            value={res.next_step === null ? 'null' : res.next_step}
                            onChange={(e) => {
                              const val = e.target.value === 'null' ? null : Number(e.target.value);
                              updateResponse(step.id, resIdx, 'next_step', val);
                            }}
                            className="text-[11px] bg-zinc-900 border border-zinc-850 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="null">End Combo (null)</option>
                            {steps.map(s => (
                              <option key={s.id} value={s.id}>Step {s.id}</option>
                            ))}
                          </select>
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => removeResponse(step.id, resIdx)}
                          className="text-zinc-600 hover:text-red-400 p-1 ml-auto"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 3: End Board */}
      {activeTab === 'endboard' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left panel: monsters/spells select */}
          <div className="md:col-span-7 space-y-6">
            {/* Monsters Selection */}
            <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Final Monsters Board</h3>
                <p className="text-[10px] text-zinc-500 mt-1">Select the monsters present on your final field.</p>
              </div>

              <div className="max-h-[220px] overflow-y-auto border border-zinc-900 rounded p-2 space-y-1 custom-scrollbar bg-zinc-950/60">
                {allUniqueDeckCards.filter(card => {
                  // Only show monster-type cards; keep cards of unknown type visible so nothing hides silently.
                  const t = cardDetails[card.id]?.type?.toLowerCase();
                  return !t || t.includes('monster');
                }).map(card => {
                  const isSelected = endBoardMonsters.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleEndBoardMonster(card.id)}
                      className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors ${
                        isSelected 
                          ? 'bg-indigo-950/20 hover:bg-indigo-950/30 text-indigo-300 border border-indigo-900/50' 
                          : 'hover:bg-zinc-905 border border-transparent text-zinc-450'
                      }`}
                    >
                      <span>{card.name}</span>
                      {isSelected && <span className="text-[9px] font-mono text-indigo-400">Monst</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spells/Traps Selection */}
            <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Final Spells & Traps Board</h3>
                <p className="text-[10px] text-zinc-500 mt-1">Select backrow cards or field spells active on your final board.</p>
              </div>

              <div className="max-h-[220px] overflow-y-auto border border-zinc-900 rounded p-2 space-y-1 custom-scrollbar bg-zinc-950/60">
                {allUniqueDeckCards.filter(c => !c.isExtra).filter(card => {
                  // Only show spell/trap cards; keep unknown-type cards visible.
                  const t = cardDetails[card.id]?.type?.toLowerCase();
                  return !t || t.includes('spell') || t.includes('trap');
                }).map(card => {
                  const isSelected = endBoardSpellsTraps.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleEndBoardSpellTrap(card.id)}
                      className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors ${
                        isSelected 
                          ? 'bg-violet-950/20 hover:bg-violet-950/30 text-violet-300 border border-violet-900/50' 
                          : 'hover:bg-zinc-905 border border-transparent text-zinc-455'
                      }`}
                    >
                      <span>{card.name}</span>
                      {isSelected && <span className="text-[9px] font-mono text-violet-400">Set S/T</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel: text interruptions */}
          <div className="md:col-span-5 rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4 h-fit">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Target Interruptions</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Summarize raw negation capability (e.g. 1 Omni-Negate, 1 GY Banish).</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1 Spell Negate"
                  value={interruptionInput}
                  onChange={(e) => setInterruptionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterruption())}
                  className="flex-1 text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addInterruption}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-350 rounded text-xs font-semibold"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                {interruptions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-850 text-xs text-zinc-300">
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeInterruption(index)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {interruptions.length === 0 && (
                  <div className="text-[10px] font-mono text-zinc-600 italic py-2">No interruptions added yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Card Picker Modal (Triggered by Step Associated Card) */}
      {pickerStepId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[80vh] mx-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-3.5 shrink-0">
              <h3 className="text-sm font-bold text-zinc-100">Select Associated Card (Step {pickerStepId})</h3>
              <button 
                onClick={() => {
                  setPickerStepId(null);
                  setPickerSearchQuery('');
                }} 
                className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Presets Row */}
            <div className="border-b border-zinc-900 px-5 py-3 flex gap-2 shrink-0 flex-wrap bg-zinc-950/80">
              {(['NONE', 'TOKEN', 'OPPONENT'] as const).map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    updateStepField(pickerStepId, 'cardId', preset);
                    setPickerStepId(null);
                    setPickerSearchQuery('');
                  }}
                  className="px-3.5 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 text-xs font-mono text-zinc-300 font-semibold transition-all active:scale-[0.97]"
                >
                  {preset === 'NONE' ? 'NONE / GENERAL' : preset === 'TOKEN' ? 'TOKEN' : 'OPPONENT ACTION'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="border-b border-zinc-900 px-5 py-3 shrink-0">
              <input
                type="text"
                placeholder="Search card in deck by name..."
                value={pickerSearchQuery}
                onChange={(e) => setPickerSearchQuery(e.target.value)}
                className="w-full text-xs bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Scrollable Card Grid */}
            <div className="flex-1 overflow-y-auto p-5 bg-zinc-950/60 custom-scrollbar">
              <div className="grid grid-cols-4 gap-3">
                {allUniqueDeckCards
                  .filter(c => c.name.toLowerCase().includes(pickerSearchQuery.toLowerCase()))
                  .map(card => (
                    <div
                      key={card.id}
                      onClick={() => {
                        updateStepField(pickerStepId, 'cardId', card.id);
                        setPickerStepId(null);
                        setPickerSearchQuery('');
                      }}
                      className="cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all"
                    >
                      <CardDisplay
                        cardId={card.id}
                        size="sm"
                        details={cardDetails[card.id]}
                        onMouseEnter={onCardMouseEnter}
                        onMouseLeave={onCardMouseLeave}
                        onMouseMove={onCardMouseMove}
                      />
                      {deckProfile?.cards[card.id]?.roles?.length ? (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                          {deckProfile.cards[card.id].roles.map(role => (
                            <CardRoleBadge key={role} role={role} size="xs" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                {allUniqueDeckCards.filter(c => c.name.toLowerCase().includes(pickerSearchQuery.toLowerCase())).length === 0 && (
                  <div className="col-span-4 text-center text-xs font-mono text-zinc-600 py-8">
                    No cards match your search criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
