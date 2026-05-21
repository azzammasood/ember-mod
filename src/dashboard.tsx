import { Devvit } from '@devvit/public-api';
import type { EmberConfig, HeatLevel, SignalSnapshot } from './types.js';

const FLAME = '\u{1F525}';
const GREEN = '\u{1F7E2}';
const YELLOW = '\u{1F7E1}';
const ORANGE = '\u{1F7E0}';
const RED = '\u{1F534}';

const LEVEL_META: Record<HeatLevel, { emoji: string; label: string; bg: string; accent: string; soft: string }> = {
  cool: { emoji: GREEN, label: 'All Clear', bg: '#123524', accent: '#22c55e', soft: '#163f2a' },
  warming: { emoji: YELLOW, label: 'Warming Up', bg: '#4a3800', accent: '#facc15', soft: '#5f4600' },
  hot: { emoji: ORANGE, label: 'Getting Hot', bg: '#7a2e00', accent: '#fb923c', soft: '#923900' },
  ember: { emoji: RED, label: 'Act Now', bg: '#7a0000', accent: '#ef4444', soft: '#991b1b' },
};

type HeatmapSignal = {
  key: keyof Pick<
    SignalSnapshot,
    'reportSpike' | 'removalSurge' | 'newAccountFlood' | 'velocitySpike' | 'controversyCluster'
  >;
  label: string;
  max: number;
  color: string;
};

const SIGNALS: HeatmapSignal[] = [
  { key: 'reportSpike', label: 'Reports', max: 30, color: '#FF4444' },
  { key: 'removalSurge', label: 'Removals', max: 25, color: '#FF8C00' },
  { key: 'newAccountFlood', label: 'New Accts', max: 20, color: '#FFD700' },
  { key: 'velocitySpike', label: 'Velocity', max: 15, color: '#00BFFF' },
  { key: 'controversyCluster', label: 'Controversy', max: 10, color: '#DA70D6' },
];

export function renderDashboard(snap: SignalSnapshot | null, config: EmberConfig): JSX.Element {
  if (!snap) {
    return (
      <vstack alignment="middle center" padding="large" gap="medium" width="100%" height="100%" backgroundColor="#070b12">
        <text size="xxlarge" weight="bold" color="#FF6B35">{FLAME} EMBER</text>
        <text size="large" color="#d1d5db">Warming up...</text>
        <text size="small" color="#9ca3af">Ember is collecting baseline data.</text>
        <text size="small" color="#9ca3af">Check back in a few minutes.</text>
      </vstack>
    );
  }

  const meta = LEVEL_META[snap.level];
  return (
    <vstack alignment="top center" padding="none" gap="none" width="100%" height="100%" backgroundColor="#070b12">
      <vstack padding="small" gap="small" width="88%" height="100%" backgroundColor="#070b12">
        <hstack alignment="middle center" gap="small" width="100%">
          <vstack width="8px" height="28px" backgroundColor="#FF6B35" cornerRadius="full" />
          <vstack gap="none" width="100%">
            <text size="large" weight="bold" color="#FF6B35">EMBER</text>
            <text size="xsmall" color="#94a3b8">Live community threat radar</text>
          </vstack>
        </hstack>

        <vstack backgroundColor={meta.bg} cornerRadius="large" padding="medium" gap="small" width="100%">
          <hstack alignment="middle center" gap="small" width="100%">
            <text size="xlarge" weight="bold" color="#ffffff">{snap.total}/100</text>
            <text size="medium" weight="bold" color="#ffffff">{meta.emoji} {meta.label}</text>
          </hstack>
          <text size="xsmall" color="#f8fafc">{statusLine(snap)}</text>
          <hstack gap="none" width="100%" height="10px">
            <vstack width={`${snap.total}%`} height="10px" backgroundColor="#ffffff" cornerRadius="full" />
            <vstack width={`${100 - snap.total}%`} height="10px" backgroundColor="#334155" cornerRadius="full" />
          </hstack>
        </vstack>

        <vstack backgroundColor="#0f172a" cornerRadius="large" padding="small" gap="small" width="100%">
          <hstack alignment="middle center" width="100%">
            <text size="small" weight="bold" color="#e2e8f0">Signal Heatmap</text>
            <spacer size="small" />
            <text size="xsmall" color="#64748b">Risk: {dominantSignal(snap)}</text>
          </hstack>
          {heatmapRow(SIGNALS[0], snap)}
          {heatmapRow(SIGNALS[1], snap)}
          {heatmapRow(SIGNALS[2], snap)}
          {heatmapRow(SIGNALS[3], snap)}
          {heatmapRow(SIGNALS[4], snap)}
        </vstack>

        <vstack backgroundColor="#111827" cornerRadius="medium" padding="small" gap="small" width="100%">
          <text size="xsmall" color={meta.accent} weight="bold">Suggested action</text>
          <text size="xsmall" color="#cbd5e1">{recommendedAction(snap)}</text>
        </vstack>

        <hstack alignment="middle center" width="100%">
          <text size="xsmall" color="#64748b">Updated {formatTime(snap.computedAt)}</text>
          <spacer size="medium" />
          <text size="xsmall" color="#64748b">Threshold {config.alertThreshold} - {baselineText(snap)}</text>
        </hstack>
      </vstack>
    </vstack>
  );
}

export function renderLoadingDashboard(): JSX.Element {
  return (
    <vstack alignment="middle center" padding="large" gap="medium" width="100%" height="100%" backgroundColor="#070b12">
      <text size="xxlarge" weight="bold" color="#FF6B35">{FLAME} EMBER</text>
      <text size="medium" color="#9ca3af">Loading heat data...</text>
    </vstack>
  );
}

export function formatTime(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 30 * 1000) return 'just now';
  if (delta < 60 * 60 * 1000) return `${Math.floor(delta / 60000)} min ago`;
  return `${new Date(ms).toISOString().slice(11, 16)} UTC`;
}

function heatmapRow(signal: HeatmapSignal, snap: SignalSnapshot): JSX.Element {
  const score = snap[signal.key];
  const activeCells = Math.max(0, Math.min(10, Math.ceil((score / signal.max) * 10)));
  return (
    <hstack gap="small" alignment="middle center" width="100%">
      <text size="xsmall" color="#cbd5e1" weight="bold" width="76px" overflow="ellipsis">{signal.label}</text>
      {heatCell(1, activeCells, signal.color)}
      {heatCell(2, activeCells, signal.color)}
      {heatCell(3, activeCells, signal.color)}
      {heatCell(4, activeCells, signal.color)}
      {heatCell(5, activeCells, signal.color)}
      {heatCell(6, activeCells, signal.color)}
      {heatCell(7, activeCells, signal.color)}
      {heatCell(8, activeCells, signal.color)}
      {heatCell(9, activeCells, signal.color)}
      {heatCell(10, activeCells, signal.color)}
      <text size="xsmall" color="#94a3b8" width="42px">{score}/{signal.max}</text>
    </hstack>
  );
}

function heatCell(index: number, activeCells: number, color: string): JSX.Element {
  const active = index <= activeCells;
  return (
    <vstack
      width="12px"
      height="12px"
      cornerRadius="small"
      backgroundColor={active ? color : '#1e293b'}
    />
  );
}

function statusLine(snap: SignalSnapshot): string {
  if (snap.total >= 75) return 'Multiple signals are elevated. Moderator action is recommended.';
  if (snap.total >= 56) return 'Activity is heating up. Review active threads and reports.';
  if (snap.total >= 31) return 'Early warning signals are present. Keep watch.';
  return 'Normal activity. Ember is monitoring quietly.';
}

function recommendedAction(snap: SignalSnapshot): string {
  if (snap.total >= 75) return 'Lock volatile threads, review reports, and alert the mod team.';
  if (snap.total >= 56) return 'Review active reports and watch fast-moving threads.';
  if (snap.total >= 31) return 'Keep watching. Early warning signals are present.';
  return 'No action needed. Ember will alert mods if the heat rises.';
}

function dominantSignal(snap: SignalSnapshot): string {
  let best = SIGNALS[0];
  let bestPct = snap[best.key] / best.max;
  for (const signal of SIGNALS) {
    const pct = snap[signal.key] / signal.max;
    if (pct > bestPct) {
      best = signal;
      bestPct = pct;
    }
  }

  if (bestPct === 0) return 'None';
  return best.label;
}

function baselineText(snap: SignalSnapshot): string {
  if (snap.reportSpike === 0 && snap.velocitySpike === 0) {
    return 'Building';
  }
  return 'Active';
}
