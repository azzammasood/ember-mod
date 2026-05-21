import { Devvit } from '@devvit/public-api';
import type { AlertRecord, EmberConfig, HeatLevel, SignalSnapshot } from './types.js';

const FLAME = '\u{1F525}';
const GREEN = '\u{1F7E2}';
const YELLOW = '\u{1F7E1}';
const ORANGE = '\u{1F7E0}';
const RED = '\u{1F534}';

const LEVEL_META: Record<HeatLevel, { emoji: string; label: string; bg: string; accent: string }> = {
  cool: { emoji: GREEN, label: 'All Clear', bg: '#123524', accent: '#22c55e' },
  warming: { emoji: YELLOW, label: 'Warming Up', bg: '#4a3800', accent: '#facc15' },
  hot: { emoji: ORANGE, label: 'Getting Hot', bg: '#7a2e00', accent: '#fb923c' },
  ember: { emoji: RED, label: 'Act Now', bg: '#7a0000', accent: '#ef4444' },
};

type DashboardData = {
  history?: SignalSnapshot[];
  lastAlert?: AlertRecord | null;
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

export function renderDashboard(
  snap: SignalSnapshot | null,
  config: EmberConfig,
  data: DashboardData = {},
): JSX.Element {
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
  const primary = dominantSignal(snap);
  return (
    <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor="#070b12">
      <hstack gap="none" width="100%">
        <vstack width="4%" />
        <vstack gap="small" width="92%" backgroundColor="#070b12">
          <hstack alignment="middle center" gap="small" width="100%">
            <vstack width="6px" height="24px" backgroundColor="#FF6B35" cornerRadius="full" />
            <vstack gap="none" width="100%">
              <text size="large" weight="bold" color="#FF6B35">EMBER</text>
              <text size="xsmall" color="#94a3b8">Community heat radar</text>
            </vstack>
            <text size="xsmall" color={meta.accent} weight="bold">{modeLabel(snap)}</text>
          </hstack>

          <hstack gap="small" width="100%">
            <vstack backgroundColor={meta.bg} cornerRadius="large" padding="small" gap="small" width="35%">
              <text size="xxlarge" weight="bold" color="#ffffff">{snap.total}</text>
              <text size="xsmall" color="#e5e7eb">/100 Heat Score</text>
              <text size="small" weight="bold" color="#ffffff">{meta.emoji} {meta.label}</text>
              <text size="xsmall" color="#f8fafc">{alertDistance(snap, config)}</text>
              <text size="xsmall" color="#cbd5e1">Primary: {primary}</text>
            </vstack>

            <vstack backgroundColor="#0f172a" cornerRadius="large" padding="small" gap="small" width="65%">
              <hstack alignment="middle center" width="100%">
                <text size="small" weight="bold" color="#e2e8f0">Signal Heatmap</text>
                <spacer size="small" />
                <text size="xsmall" color="#64748b">Mode: {modeLabel(snap)}</text>
              </hstack>
              {heatmapRow(SIGNALS[0], snap)}
              {heatmapRow(SIGNALS[1], snap)}
              {heatmapRow(SIGNALS[2], snap)}
              {heatmapRow(SIGNALS[3], snap)}
              {heatmapRow(SIGNALS[4], snap)}
            </vstack>
          </hstack>

          <hstack gap="small" width="100%">
            <vstack backgroundColor="#111827" cornerRadius="medium" padding="small" gap="small" width="62%">
              <hstack alignment="middle center" width="100%">
                <text size="xsmall" color="#94a3b8" weight="bold">Trend</text>
                <spacer size="small" />
                <text size="xsmall" color="#64748b">last scans</text>
              </hstack>
              {sparkline(data.history ?? [], snap)}
            </vstack>

            <vstack backgroundColor="#111827" cornerRadius="medium" padding="small" gap="small" width="38%">
              <text size="xsmall" color={meta.accent} weight="bold">Ops</text>
              <text size="xsmall" color="#cbd5e1">Last alert: {lastAlertText(data.lastAlert)}</text>
              <text size="xsmall" color="#cbd5e1">Baseline: {baselineText(snap)}</text>
            </vstack>
          </hstack>

          <hstack alignment="middle center" width="100%">
            <text size="xsmall" color="#64748b">Updated {formatTime(snap.computedAt)}</text>
            <spacer size="medium" />
            <text size="xsmall" color="#64748b">Threshold {config.alertThreshold}</text>
          </hstack>
        </vstack>
        <vstack width="4%" />
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

export function renderSafeDashboardFallback(): JSX.Element {
  return (
    <vstack padding="large" gap="medium" width="100%" height="100%" backgroundColor="#070b12">
      <text size="xlarge" weight="bold" color="#FF6B35">EMBER</text>
      <text size="medium" color="#e5e7eb">Community Heat Monitor</text>
      <text size="small" color="#94a3b8">Dashboard data is loading. Use Check Heat Now to refresh the latest score.</text>
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

function sparkline(history: SignalSnapshot[], snap: SignalSnapshot): JSX.Element {
  const samples = normalizeHistory(history, snap);
  return (
    <hstack gap="small" alignment="middle center" width="100%">
      {sparkCell(samples[0])}
      {sparkCell(samples[1])}
      {sparkCell(samples[2])}
      {sparkCell(samples[3])}
      {sparkCell(samples[4])}
      {sparkCell(samples[5])}
      {sparkCell(samples[6])}
      {sparkCell(samples[7])}
      <spacer size="small" />
      <text size="xsmall" color="#94a3b8">{trendText(samples)}</text>
    </hstack>
  );
}

function sparkCell(score: number): JSX.Element {
  return (
    <vstack
      width="16px"
      height={sparkHeight(score)}
      cornerRadius="small"
      backgroundColor={scoreColor(score)}
    />
  );
}

function normalizeHistory(history: SignalSnapshot[], snap: SignalSnapshot): number[] {
  const scores = history.map((entry) => entry.total).concat(snap.total).slice(-8);
  while (scores.length < 8) scores.unshift(0);
  return scores;
}

function trendText(scores: number[]): string {
  const first = scores[0] ?? 0;
  const last = scores[scores.length - 1] ?? 0;
  if (last >= first + 10) return 'rising';
  if (last <= first - 10) return 'cooling';
  return 'steady';
}

function sparkHeight(score: number): '22px' | '18px' | '14px' | '10px' {
  if (score >= 75) return '22px';
  if (score >= 56) return '18px';
  if (score >= 31) return '14px';
  return '10px';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#ef4444';
  if (score >= 56) return '#fb923c';
  if (score >= 31) return '#facc15';
  return '#1e293b';
}

function alertDistance(snap: SignalSnapshot, config: EmberConfig): string {
  if (config.alertThreshold <= 0) return 'Alerts disabled';
  if (snap.total >= config.alertThreshold) return 'Alert line reached';
  return `+${config.alertThreshold - snap.total} heat to alert`;
}

function modeLabel(snap: SignalSnapshot): string {
  if (snap.total >= 75) return 'Incident Mode';
  if (snap.total >= 56) return 'Active Watch';
  if (snap.total >= 31) return 'Early Warning';
  return 'Quiet Watch';
}

function lastAlertText(lastAlert: AlertRecord | null | undefined): string {
  if (!lastAlert) return 'None';
  return formatTime(lastAlert.firedAt);
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
