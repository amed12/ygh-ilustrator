'use client';

import React, { useState, useMemo } from 'react';
import { DeckList, ComboRoute, ComboStep, ComboResponse, DeckProfile, YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { CardDisplay } from './CardDisplay';
import { CardRoleBadge } from './CardRoleBadge';
import { TacticalBadge } from './TacticalBadge';
import { CardPickerModal } from './CardPickerModal';
import { ActionComposer } from './ActionComposer';
import { resolveCardName } from '../utils/cardName';
import {
  Plus, Trash, ArrowLeft, ArrowRight, FloppyDisk, DownloadSimple,
  CaretLeft, CaretRight, Check, PencilSimple
} from '@phosphor-icons/react';
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

const WIZARD_PAGES = ['Info & Starters', 'Steps', 'End Board', 'Review & Save'] as const;

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

  // Wizard position: 0 Info, 1 Steps (one step per screen), 2 End Board, 3 Review.
  const [page, setPage] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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

  // Which step (by id) the card picker is choosing an associated card for.
  const [pickerStepId, setPickerStepId] = useState<number | null>(null);

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

  // Deduplicated deck cards for endboard lists
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
        const idx = prev.indexOf(cardId);
        if (idx !== -1) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return prev;
      }
      return [...prev, cardId];
    });
  };

  const getRequiredCardCount = (cardId: string) => {
    return requiredCards.filter(id => id === cardId).length;
  };

  // ── Step management ─────────────────────────────────────────────────────────

  /** Insert a fresh step right after the given array index and focus it. */
  const addStepAfter = (index: number) => {
    const nextId = steps.length > 0 ? Math.max(...steps.map(s => s.id)) + 1 : 1;
    const next = [...steps];
    next.splice(index + 1, 0, {
      id: nextId,
      action: '',
      cardId: 'NONE',
      responses: [{ trigger: 'success', next_step: null }]
    });
    setSteps(next);
    setActiveStepIndex(index + 1);
  };

  const removeStep = (id: number) => {
    if (steps.length <= 1) return; // always keep one step
    // Drop the step and scrub any branch pointers in the remaining steps that referenced it,
    // so we never leave a dangling next_step pointing at a step that no longer exists.
    const next = steps
      .filter(s => s.id !== id)
      .map(s => s.responses
        ? { ...s, responses: s.responses.map(r => r.next_step === id ? { ...r, next_step: null } : r) }
        : s
      );
    setSteps(next);
    setActiveStepIndex(i => Math.min(i, next.length - 1));
  };

  // Reorder a step by swapping its array position with its neighbour. IDs stay fixed (they are
  // stable labels that next_step pointers reference), so only the displayed order changes.
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
    setActiveStepIndex(target);
  };

  const updateStepField = <K extends keyof ComboStep>(id: number, field: K, value: ComboStep[K]) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
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

  // ── End board ───────────────────────────────────────────────────────────────

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

  /** Monster cards used by steps but not yet on the end board — one-tap suggestions. */
  const suggestedEndBoardMonsters = useMemo(() => {
    const used = steps
      .map(s => s.cardId)
      .filter(id => !['NONE', 'TOKEN', 'OPPONENT'].includes(id.toUpperCase()));
    const unique = Array.from(new Set(used));
    return unique.filter(id => {
      const t = cardDetails[id]?.type?.toLowerCase();
      return (!t || t.includes('monster')) && !endBoardMonsters.includes(id);
    });
  }, [steps, cardDetails, endBoardMonsters]);

  // ── Save / export ───────────────────────────────────────────────────────────

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

  /** Blocking issues shown on the Review page; save is disabled while any exist. */
  const validationIssues = useMemo(() => {
    const issues: { message: string; goToPage: number; goToStepIndex?: number }[] = [];
    if (!name.trim()) {
      issues.push({ message: 'Combo has no name.', goToPage: 0 });
    }
    const actionedSteps = steps.filter(s => s.action.trim());
    if (actionedSteps.length === 0) {
      issues.push({ message: 'No step has an action yet — describe at least one play.', goToPage: 1, goToStepIndex: 0 });
    }
    steps.forEach((s, i) => {
      if (s.action.trim() && (!s.cardId || s.cardId.toUpperCase() === 'NONE')) {
        issues.push({
          message: `Step ${s.id} has an action but no card assigned (use TOKEN/OPPONENT for generic actions).`,
          goToPage: 1,
          goToStepIndex: i
        });
      }
    });
    return issues;
  }, [name, steps]);

  const handleSave = () => {
    if (validationIssues.length > 0) {
      const first = validationIssues[0];
      setPage(first.goToPage);
      if (first.goToStepIndex !== undefined) setActiveStepIndex(first.goToStepIndex);
      return;
    }
    onSave(buildRouteObject());
  };

  // ── Wizard navigation ───────────────────────────────────────────────────────

  const canLeaveInfo = name.trim().length > 0;

  const goNext = () => {
    if (page === 0) {
      if (canLeaveInfo) setPage(1);
    } else if (page === 1) {
      if (activeStepIndex < steps.length - 1) {
        setActiveStepIndex(activeStepIndex + 1);
      } else {
        setPage(2);
      }
    } else if (page === 2) {
      setPage(3);
    }
  };

  const goBack = () => {
    if (page === 1) {
      if (activeStepIndex > 0) {
        setActiveStepIndex(activeStepIndex - 1);
      } else {
        setPage(0);
      }
    } else if (page > 0) {
      setPage(page - 1);
    }
  };

  const nextLabel = page === 0
    ? 'Next: Steps'
    : page === 1
      ? (activeStepIndex < steps.length - 1 ? `Next Step (${activeStepIndex + 2}/${steps.length})` : 'Next: End Board')
      : page === 2
        ? 'Next: Review'
        : null;

  const activeStep = steps[activeStepIndex];

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-24">
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
            {isEditing ? (keepId ? 'Edit Combo' : 'Edit a Copy') : 'Combo Builder'}
          </h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            {isEditing
              ? (keepId ? 'Editing this combo in place' : 'Saving will create a new editable copy')
              : 'Build your combo step by step — just keep hitting Next'}
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
        >
          <DownloadSimple size={14} />
          <span>Export JSON</span>
        </button>
      </div>

      {/* Horizontal Stepper */}
      <div className="flex items-center gap-1">
        {WIZARD_PAGES.map((label, i) => {
          const reachable = i <= page || isEditing || (i > 0 && canLeaveInfo);
          const isActive = page === i;
          const isDone = page > i;
          return (
            <React.Fragment key={label}>
              {i > 0 && <div className={`h-px flex-1 min-w-3 ${page >= i ? 'bg-indigo-600' : 'bg-zinc-800'}`} />}
              <button
                type="button"
                onClick={() => reachable && setPage(i)}
                disabled={!reachable}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                    : isDone
                      ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-500 disabled:opacity-50'
                }`}
              >
                <span className={`flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-mono ${
                  isDone ? 'bg-emerald-600 text-white' : isActive ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  {isDone ? <Check size={10} weight="bold" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Page 0: Info & Starters ─────────────────────────────────────────── */}
      {page === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Basic Information</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Combo Name *</label>
                <input
                  type="text"
                  autoFocus
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
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Description / Goal (optional)</label>
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

          {/* Starters Grid Selector */}
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

                      {deckProfile?.cards[entry.id]?.roles?.length ? (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                          {deckProfile.cards[entry.id].roles.map(role => (
                            <CardRoleBadge key={role} role={role} size="xs" />
                          ))}
                        </div>
                      ) : null}

                      {isSelected && (
                        <span className="absolute -top-1 -right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-950 text-[9px] font-bold text-white shadow-lg">
                          {selectedCount}
                        </span>
                      )}

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

      {/* ── Page 1: Steps (one per screen) ──────────────────────────────────── */}
      {page === 1 && activeStep && (
        <div className="space-y-4">
          {/* Filmstrip: all steps as horizontal thumbnails */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStepIndex(i)}
                className={`shrink-0 flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${
                  i === activeStepIndex
                    ? 'border-indigo-500 bg-indigo-950/30 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
                title={s.action || '(empty step)'}
              >
                <CardDisplay cardId={s.cardId} size="xs" details={cardDetails[s.cardId]} />
                <span className={`text-[9px] font-mono ${i === activeStepIndex ? 'text-indigo-300' : 'text-zinc-500'}`}>
                  {i + 1}{!s.action.trim() && ' •'}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => addStepAfter(steps.length - 1)}
              className="shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-800 hover:border-indigo-600 hover:text-indigo-400 text-zinc-600 w-12 h-[74px] transition-all"
              title="Add step at the end"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Active step editor */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-100">Step {activeStepIndex + 1} <span className="text-zinc-600 font-normal">/ {steps.length}</span></span>
                <span className="text-[9px] font-mono text-zinc-600">node #{activeStep.id}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveStep(activeStepIndex, -1)}
                  disabled={activeStepIndex === 0}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 p-1.5 transition-colors"
                  title="Move step earlier"
                >
                  <CaretLeft size={14} />
                </button>
                <button
                  onClick={() => moveStep(activeStepIndex, 1)}
                  disabled={activeStepIndex === steps.length - 1}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 p-1.5 transition-colors"
                  title="Move step later"
                >
                  <CaretRight size={14} />
                </button>
                <button
                  onClick={() => addStepAfter(activeStepIndex)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1"
                >
                  <Plus size={11} /> Add Step After
                </button>
                <button
                  onClick={() => removeStep(activeStep.id)}
                  disabled={steps.length <= 1}
                  className="text-zinc-600 hover:text-red-400 disabled:opacity-30 p-1.5 transition-colors"
                  title="Delete this step"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Card of this step */}
              <div className="md:col-span-3 flex flex-col items-center gap-2">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase self-start">Step Card</label>
                <div
                  onClick={() => setPickerStepId(activeStep.id)}
                  className="cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-600/60 transition-all"
                >
                  <CardDisplay
                    cardId={activeStep.cardId}
                    size="md"
                    details={cardDetails[activeStep.cardId]}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPickerStepId(activeStep.id)}
                  className="w-full text-center text-[10px] bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 rounded px-2 py-1.5 text-zinc-300 transition-colors"
                >
                  <span className="block truncate font-medium">{resolveCardName(activeStep.cardId, cardDetails)}</span>
                  <span className="text-indigo-400 font-mono font-bold uppercase text-[9px]">Change</span>
                </button>
              </div>

              {/* Action composer */}
              <div className="md:col-span-9">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5">
                  What happens in this step? <span className="text-zinc-600 normal-case">(tap chips to compose)</span>
                </label>
                <ActionComposer
                  key={activeStep.id}
                  value={activeStep.action}
                  onChange={(text) => updateStepField(activeStep.id, 'action', text)}
                  onCardMentioned={(cardId) => {
                    // First mentioned card becomes the step's card if none was chosen yet.
                    if (activeStep.cardId.toUpperCase() === 'NONE') {
                      updateStepField(activeStep.id, 'cardId', cardId);
                    }
                  }}
                  deck={deck}
                  cardDetails={cardDetails}
                  deckProfile={deckProfile}
                  onCardMouseEnter={onCardMouseEnter}
                  onCardMouseLeave={onCardMouseLeave}
                  onCardMouseMove={onCardMouseMove}
                />
              </div>
            </div>

            {/* Responses & Branching */}
            <div className="space-y-2 border-t border-zinc-900/60 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">If the opponent responds… ({activeStep.responses?.length || 0} branches)</span>
                <button
                  type="button"
                  onClick={() => addResponse(activeStep.id)}
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus size={10} /> Add Branch
                </button>
              </div>

              <div className="space-y-1.5">
                {activeStep.responses?.map((res, resIdx) => (
                  <div key={resIdx} className="flex flex-wrap items-center gap-3 bg-zinc-900/40 border border-zinc-900 p-2 rounded">
                    <div className="flex-1 min-w-[120px]">
                      <select
                        value={res.trigger}
                        onChange={(e) => updateResponse(activeStep.id, resIdx, 'trigger', e.target.value)}
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">Goes to:</span>
                      <select
                        value={res.next_step === null ? 'null' : res.next_step}
                        onChange={(e) => {
                          const val = e.target.value === 'null' ? null : Number(e.target.value);
                          updateResponse(activeStep.id, resIdx, 'next_step', val);
                        }}
                        className="text-[11px] bg-zinc-900 border border-zinc-850 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="null">End Combo</option>
                        {steps.map((s, i) => (
                          <option key={s.id} value={s.id}>Step {i + 1} (node #{s.id})</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeResponse(activeStep.id, resIdx)}
                      className="text-zinc-600 hover:text-red-400 p-1 ml-auto"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page 2: End Board ───────────────────────────────────────────────── */}
      {page === 2 && (
        <div className="space-y-4">
          {/* Quick add from steps */}
          {suggestedEndBoardMonsters.length > 0 && (
            <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/10 p-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
                Quick add — monsters used in your steps:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedEndBoardMonsters.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleEndBoardMonster(id)}
                    className="flex items-center gap-1.5 rounded-full border border-indigo-800/60 bg-indigo-950/30 hover:bg-indigo-950/60 px-2.5 py-1 text-[10px] text-indigo-200 transition-all active:scale-[0.97]"
                  >
                    <Plus size={10} />
                    {resolveCardName(id, cardDetails)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-6">
              {/* Monsters Selection */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Final Monsters Board ({endBoardMonsters.length})</h3>
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
                        {isSelected && <span className="text-[9px] font-mono text-indigo-400">On Field</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spells/Traps Selection */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Final Spells & Traps Board ({endBoardSpellsTraps.length})</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">Select backrow cards or field spells active on your final board.</p>
                </div>

                <div className="max-h-[220px] overflow-y-auto border border-zinc-900 rounded p-2 space-y-1 custom-scrollbar bg-zinc-950/60">
                  {allUniqueDeckCards.filter(c => !c.isExtra).filter(card => {
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

            {/* Interruptions */}
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
        </div>
      )}

      {/* ── Page 3: Review & Save ───────────────────────────────────────────── */}
      {page === 3 && (
        <div className="space-y-5">
          {/* Validation issues */}
          {validationIssues.length > 0 && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Fix before saving:</p>
              {validationIssues.map((issue, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPage(issue.goToPage);
                    if (issue.goToStepIndex !== undefined) setActiveStepIndex(issue.goToStepIndex);
                  }}
                  className="flex items-center gap-2 text-xs text-amber-200/90 hover:text-amber-100 transition-colors"
                >
                  <PencilSimple size={12} className="shrink-0" />
                  <span className="text-left">{issue.message}</span>
                </button>
              ))}
            </div>
          )}

          {/* Header summary */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-zinc-100">{name.trim() || 'Untitled Custom Combo'}</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">
                  {archetype.trim() || 'Custom Playbook'} · {steps.length} steps · {requiredCards.length} starters
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {tags.map((tag, i) => (
                  <span key={i} className="text-[9px] font-mono uppercase bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {description.trim() && <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>}
            {requiredCards.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.from(new Set(requiredCards)).map(id => (
                  <span key={id} className="text-[10px] rounded bg-emerald-950/30 border border-emerald-900/40 text-emerald-300 px-2 py-0.5">
                    {resolveCardName(id, cardDetails)}
                    {requiredCards.filter(c => c === id).length > 1 && ` ×${requiredCards.filter(c => c === id).length}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Steps walkthrough (mirrors ComboNavigator layout) */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Combo line — click a step to edit it</p>
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setPage(1); setActiveStepIndex(i); }}
                className="w-full flex items-start gap-4 rounded-xl border border-zinc-900 bg-zinc-950 hover:border-zinc-700 p-4 text-left transition-all group"
              >
                <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:border-indigo-700 group-hover:text-indigo-300 mt-1">
                  {i + 1}
                </span>
                <div className="shrink-0">
                  <CardDisplay cardId={s.cardId} size="sm" details={cardDetails[s.cardId]} />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-[10px] font-mono text-zinc-500">{resolveCardName(s.cardId, cardDetails)}</p>
                  <p className={`text-sm font-semibold leading-snug ${s.action.trim() ? 'text-zinc-100' : 'text-zinc-600 italic'}`}>
                    {s.action.trim() || '(no action written yet)'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.responses?.map((r, ri) => (
                      <span
                        key={ri}
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          r.trigger === 'success'
                            ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-400'
                            : 'border-amber-900/50 bg-amber-950/20 text-amber-400'
                        }`}
                      >
                        {r.trigger.replace(/_/g, ' ')} → {r.next_step === null ? 'end' : `step ${steps.findIndex(x => x.id === r.next_step) + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
                <PencilSimple size={14} className="shrink-0 text-zinc-700 group-hover:text-indigo-400 mt-1 transition-colors" />
              </button>
            ))}
          </div>

          {/* End board summary */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Final End Board</p>
            {endBoardMonsters.length === 0 && endBoardSpellsTraps.length === 0 && interruptions.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No end board defined (optional).</p>
            ) : (
              <>
                {(endBoardMonsters.length > 0 || endBoardSpellsTraps.length > 0) && (
                  <div className="flex flex-wrap gap-3">
                    {[...endBoardMonsters, ...endBoardSpellsTraps].map(id => (
                      <div key={id} className="flex flex-col items-center gap-1 w-16">
                        <CardDisplay cardId={id} size="sm" details={cardDetails[id]} glow={!!existingRoute?.endBoard?.cardRoles?.[id]?.length} />
                        <span className="text-[9px] text-zinc-400 text-center leading-tight line-clamp-2">
                          {resolveCardName(id, cardDetails)}
                        </span>
                        {existingRoute?.endBoard?.cardRoles?.[id]?.map(role => (
                          <TacticalBadge key={role} role={role} size="xs" />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {interruptions.length > 0 && (
                  <ul className="space-y-1">
                    {interruptions.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                        <Check size={12} className="text-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Save actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
            >
              <DownloadSimple size={14} />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleSave}
              disabled={validationIssues.length > 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
            >
              <FloppyDisk size={16} />
              <span>{isEditing ? 'Save Changes' : 'Save to Playbook'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom wizard navigation (fixed) */}
      {page < 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={goBack}
              disabled={page === 0}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider hidden sm:block">
              {page === 1 ? `Step ${activeStepIndex + 1} of ${steps.length}` : WIZARD_PAGES[page]}
            </span>

            <button
              type="button"
              onClick={goNext}
              disabled={page === 0 && !canLeaveInfo}
              title={page === 0 && !canLeaveInfo ? 'Give the combo a name first' : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed px-5 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
            >
              <span>{nextLabel}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step-card picker */}
      <CardPickerModal
        isOpen={pickerStepId !== null}
        title={`Select the card for this step`}
        onPick={(cardId) => {
          if (pickerStepId !== null) updateStepField(pickerStepId, 'cardId', cardId);
          setPickerStepId(null);
        }}
        onClose={() => setPickerStepId(null)}
        deck={deck}
        cardDetails={cardDetails}
        deckProfile={deckProfile}
        showReserved
        onCardMouseEnter={onCardMouseEnter}
        onCardMouseLeave={onCardMouseLeave}
        onCardMouseMove={onCardMouseMove}
      />
    </div>
  );
}
