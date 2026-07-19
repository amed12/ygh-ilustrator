export function formatTriggerLabel(trigger: string): string {
  return trigger.replace(/_/g, ' ').toUpperCase();
}

export function getTriggerColor(trigger: string): string {
  if (trigger === 'success') return 'border-emerald-950 bg-emerald-950/10 hover:bg-emerald-950/30 text-emerald-400';
  if (trigger === 'maxx_c') return 'border-orange-950 bg-orange-950/10 hover:bg-orange-950/30 text-orange-400';
  if (trigger === 'ash_blossom') return 'border-pink-950 bg-pink-950/10 hover:bg-pink-950/30 text-pink-400';
  if (trigger === 'nibiru') return 'border-yellow-950 bg-yellow-950/10 hover:bg-yellow-950/30 text-yellow-400';
  return 'border-red-950 bg-red-950/10 hover:bg-red-950/30 text-red-400';
}
