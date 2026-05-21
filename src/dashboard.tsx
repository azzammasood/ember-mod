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
    <vstack padding="large" gap="medium" width="100%" backgroundColor="#070b12">
      <hstack alignment="middle center" gap="small" width="100%">
        <text size="xxlarge">{FLAME}</text>
        <vstack gap="none" width="100%">
          <text size="xxlarge" weight="bold" color="#FF6B35">EMBER</text>
          <text size="xsmall" color="#94a3b8">Live community threat radar</text>
        </vstack>
        <vstack backgroundColor={meta.soft} cornerRadius="full" padding="small">
          <text size="xsmall" color="#ffffff" weight="bold">{meta.emoji} {snap.level.toUpperCase()}</text>
        </vstack>
      </hstack>

      <vstack backgroundColor={meta.bg} cornerRadius="large" padding="large" gap="medium" width="100%">
        <hstack alignment="middle center" gap="medium" width="100%">
          <vstack gap="none">
            <text size="xxlarge" weight="bold" color="#ffffff">{snap.total}</text>
            <text size="small" color="#e5e7eb">/ 100 heat score</text>
          </vstack>
          <vstack gap="small" width="100%">
            <text size="large" weight="bold" color="#ffffff">{meta.emoji} {meta.label}</text>
            <text size="small" color="#f8fafc">{statusLine(snap)}</text>
            <hstack gap="none" width="100%" height="12px">
              <vstack width={`${snap.total}%`} height="12px" backgroundColor="#ffffff" cornerRadius="full" />
              <vstack width={`${100 - snap.total}%`} height="12px" backgroundColor="#334155" cornerRadius="full" />
            </hstack>
          </vstack>
        </hstack>
      </vstack>

      <vstack backgroundColor="#0f172a" cornerRadius="large" padding="medium" gap="small" width="100%">
        <hstack alignment="middle center" width="100%">
          <text size="small" weight="bold" color="#e2e8f0">Signal Heatmap</text>
          <spacer size="medium" />
          <text size="xsmall" color="#64748b">cool to critical</text>
        </hstack>
        {heatmapRow(SIGNALS[0], snap)}
        {heatmapRow(SIGNALS[1], snap)}
        {heatmapRow(SIGNALS[2], snap)}
        {heatmapRow(SIGNALS[3], snap)}
        {heatmapRow(SIGNALS[4], snap)}
      </vstack>

      <hstack gap="medium" width="100%">
        {miniMetric('Primary Risk', dominantSignal(snap), LEVEL_META[snap.level].accent)}
        {miniMetric('Baseline', baselineText(snap), '#38bdf8')}
      </hstack>

      <hstack gap="medium" width="100%">
        {signalCard('Reports', snap.reportSpike, 30, '#FF4444')}
        {signalCard('Removals', snap.removalSurge, 25, '#FF8C00')}
      </hstack>
      <hstack gap="medium" width="100%">
        {signalCard('New Accts', snap.newAccountFlood, 20, '#FFD700')}
        {signalCard('Velocity', snap.velocitySpike, 15, '#00BFFF')}
      </hstack>
      <hstack gap="medium" width="100%">
        {signalCard('Controversy', snap.controversyCluster, 10, '#DA70D6')}
        {miniMetric('Alert Line', `${config.alertThreshold}/100`, '#f97316')}
      </hstack>

      <hstack alignment="middle center" width="100%">
        <text size="xsmall" color="#64748b">Last updated: {formatTime(snap.computedAt)}</text>
        <spacer size="medium" />
        <text size="xsmall" color="#64748b">Cooldown: {config.alertCooldownMinutes} min</text>
      </hstack>
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
      <text size="xsmall" color="#cbd5e1" weight="bold" width="82px" overflow="ellipsis">{signal.label}</text>
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
      <text size="xsmall" color="#94a3b8" width="44px">{score}/{signal.max}</text>
    </hstack>
  );
}

function heatCell(index: number, activeCells: number, color: string): JSX.Element {
  const active = index <= activeCells;
  return (
    <vstack
      width="14px"
      height="14px"
      cornerRadius="small"
      backgroundColor={active ? color : '#1e293b'}
    />
  );
}

function signalCard(name: string, score: number, max: number, color: string): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  return (
    <vstack backgroundColor="#111827" cornerRadius="medium" padding="medium" width="100%" gap="small">
      <hstack alignment="middle center" width="100%">
        <text size="xsmall" color="#9ca3af" weight="bold" overflow="ellipsis">{name}</text>
        <spacer size="medium" />
        <text size="xsmall" color="#d1d5db">{score}/{max}</text>
      </hstack>
      <hstack gap="none" width="100%" height="8px" backgroundColor="#374151" cornerRadius="full">
        <vstack width={`${pct}%`} height="8px" backgroundColor={color} cornerRadius="full" />
        <vstack width={`${100 - pct}%`} height="8px" backgroundColor="#374151" cornerRadius="full" />
      </hstack>
    </vstack>
  );
}

function miniMetric(label: string, value: string, color: string): JSX.Element {
  return (
    <vstack backgroundColor="#111827" cornerRadius="medium" padding="medium" width="100%" gap="small">
      <text size="xsmall" color="#94a3b8" weight="bold">{label}</text>
      <text size="medium" color={color} weight="bold" overflow="ellipsis">{value}</text>
    </vstack>
  );
}

function statusLine(snap: SignalSnapshot): string {
  if (snap.total >= 75) return 'Multiple signals are elevated. Moderator action is recommended.';
  if (snap.total >= 56) return 'Activity is heating up. Review active threads and reports.';
  if (snap.total >= 31) return 'Early warning signals are present. Keep watch.';
  return 'Normal activity. Ember is monitoring quietly.';
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
