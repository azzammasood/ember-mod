import { Devvit } from '@devvit/public-api';
import type { EmberConfig, HeatLevel, SignalSnapshot } from './types.js';

const FLAME = '\u{1F525}';
const GREEN = '\u{1F7E2}';
const YELLOW = '\u{1F7E1}';
const ORANGE = '\u{1F7E0}';
const RED = '\u{1F534}';

const LEVEL_META: Record<HeatLevel, { emoji: string; label: string; bg: string }> = {
  cool: { emoji: GREEN, label: 'All Clear', bg: '#1a4731' },
  warming: { emoji: YELLOW, label: 'Warming Up', bg: '#4a3800' },
  hot: { emoji: ORANGE, label: 'Getting Hot', bg: '#7a2e00' },
  ember: { emoji: RED, label: 'Act Now', bg: '#7a0000' },
};

export function renderDashboard(snap: SignalSnapshot | null, config: EmberConfig): JSX.Element {
  if (!snap) {
    return (
      <vstack alignment="middle center" padding="large" gap="medium" width="100%" height="100%" backgroundColor="#0b1120">
        <text size="xxlarge" weight="bold" color="#FF6B35">{FLAME} EMBER</text>
        <text size="large" color="#d1d5db">Warming up...</text>
        <text size="small" color="#9ca3af">Ember is collecting baseline data.</text>
        <text size="small" color="#9ca3af">Check back in a few minutes.</text>
      </vstack>
    );
  }

  const meta = LEVEL_META[snap.level];
  return (
    <vstack padding="large" gap="medium" width="100%" backgroundColor="#0b1120">
      <hstack alignment="middle center" gap="small" width="100%">
        <text size="xxlarge">{FLAME}</text>
        <text size="xxlarge" weight="bold" color="#FF6B35">EMBER</text>
        <text size="small" color="#9ca3af">Community Heat Monitor</text>
      </hstack>

      <vstack backgroundColor={meta.bg} cornerRadius="large" padding="large" gap="small" width="100%">
        <hstack alignment="bottom center" gap="small">
          <text size="xxlarge" weight="bold" color="#ffffff">{snap.total}</text>
          <text size="medium" color="#e5e7eb">/ 100</text>
        </hstack>
        <text size="large" weight="bold" color="#ffffff">{meta.emoji} {meta.label}</text>
        <hstack gap="none" width="100%" height="10px">
          <vstack width={`${snap.total}%`} height="10px" backgroundColor="#ffffff" cornerRadius="full" />
          <vstack width={`${100 - snap.total}%`} height="10px" backgroundColor="#4b5563" cornerRadius="full" />
        </hstack>
      </vstack>

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
        <vstack backgroundColor="#111827" cornerRadius="medium" padding="medium" width="100%" gap="small">
          <text size="xsmall" color="#9ca3af" weight="bold">Baseline</text>
          <text size="small" color="#d1d5db">{baselineText(snap)}</text>
        </vstack>
      </hstack>

      <hstack alignment="middle center" width="100%">
        <text size="xsmall" color="#6b7280">Last updated: {formatTime(snap.computedAt)}</text>
        <spacer size="medium" />
        <text size="xsmall" color="#6b7280">Threshold: {config.alertThreshold}</text>
      </hstack>
    </vstack>
  );
}

export function renderLoadingDashboard(): JSX.Element {
  return (
    <vstack alignment="middle center" padding="large" gap="medium" width="100%" height="100%" backgroundColor="#0b1120">
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

function signalCard(name: string, score: number, max: number, color: string): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  return (
    <vstack backgroundColor="#111827" cornerRadius="medium" padding="medium" width="100%" gap="small">
      <text size="xsmall" color="#9ca3af" weight="bold" overflow="ellipsis">{name}</text>
      <hstack gap="small" alignment="middle center">
        <hstack gap="none" width="100%" height="8px" backgroundColor="#374151" cornerRadius="full">
          <vstack width={`${pct}%`} height="8px" backgroundColor={color} cornerRadius="full" />
          <vstack width={`${100 - pct}%`} height="8px" backgroundColor="#374151" cornerRadius="full" />
        </hstack>
        <text size="xsmall" color="#d1d5db">{score}/{max}</text>
      </hstack>
    </vstack>
  );
}

function baselineText(snap: SignalSnapshot): string {
  if (snap.reportSpike === 0 && snap.velocitySpike === 0) {
    return 'Building baseline';
  }
  return 'Active';
}
