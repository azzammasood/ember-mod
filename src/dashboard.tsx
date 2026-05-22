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
  theme?: DashboardTheme;
  panel?: DashboardPanel;
  chooser?: DashboardChooser;
  onThemePress?: () => void;
  onPanelPress?: () => void;
  onSettingsPress?: () => void;
  onRefresh?: () => void | Promise<void>;
  onChooseTheme?: (theme: DashboardTheme) => void;
  onChoosePanel?: (panel: DashboardPanel) => void;
  onCloseChooser?: () => void;
};

export type DashboardTheme = 'ember' | 'abyss' | 'dracula' | 'andromeda' | 'nightOwl' | 'synthwave' | 'mono';
export type DashboardPanel = 'trend' | 'ops' | 'actions' | 'explain';
export type DashboardChooser = 'none' | 'theme' | 'panel' | 'settings';

type DashboardPalette = {
  bg: string;
  panel: string;
  card: string;
  muted: string;
  text: string;
  accent: string;
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
  const theme = data.theme ?? 'ember';
  const panel = data.panel ?? 'trend';
  const chooser = data.chooser ?? 'none';
  const palette = themePalette(theme);

  if (chooser === 'theme') {
    return themePanel(palette, data);
  }

  if (chooser === 'settings') {
    return settingsPanel(snap, config, data.lastAlert, palette, data);
  }

  return (
    <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor={palette.bg}>
      <hstack gap="none" width="100%">
        <vstack width="5%" />
        <vstack gap="small" width="90%" backgroundColor={palette.bg}>
          <hstack alignment="middle center" gap="small" width="100%">
            <vstack width="100%" gap="none">
              <text alignment="center" size="large" weight="bold" color={palette.accent}>EMBER</text>
              <text alignment="center" size="xsmall" color={palette.muted}>Community heat radar</text>
            </vstack>
          </hstack>

          <hstack gap="small" width="100%">
            <vstack backgroundColor={meta.bg} cornerRadius="large" padding="small" gap="small" width="35%">
              <text size="xxlarge" weight="bold" color="#ffffff">{snap.total}</text>
              <text size="xsmall" color="#e5e7eb">/100 Heat Score</text>
              <text size="small" weight="bold" color="#ffffff">{meta.emoji} {meta.label}</text>
              <text size="xsmall" color="#f8fafc">{alertDistance(snap, config)}</text>
              <text size="xsmall" color="#cbd5e1">Primary: {primary}</text>
            </vstack>

            <vstack backgroundColor={palette.panel} cornerRadius="large" padding="small" gap="small" width="65%">
              <hstack alignment="middle center" width="100%">
                <text size="small" weight="bold" color={palette.text}>Signal Heatmap</text>
                <spacer size="small" />
                <text size="xsmall" color={meta.accent}>{modeLabel(snap)}</text>
              </hstack>
              {heatmapRow(SIGNALS[0], snap, palette)}
              {heatmapRow(SIGNALS[1], snap, palette)}
              {heatmapRow(SIGNALS[2], snap, palette)}
              {heatmapRow(SIGNALS[3], snap, palette)}
              {heatmapRow(SIGNALS[4], snap, palette)}
            </vstack>
          </hstack>

          <hstack alignment="middle center" gap="small" width="100%">
            <button size="small" appearance="primary" textColor="#ffffff" onPress={data.onThemePress}>Theme</button>
            <button size="small" appearance="primary" textColor="#ffffff" onPress={data.onPanelPress}>Panel</button>
            <button size="small" appearance="primary" textColor="#ffffff" onPress={data.onRefresh}>Refresh</button>
            <button size="small" appearance="primary" textColor="#ffffff" onPress={data.onSettingsPress}>Settings</button>
            <text size="xsmall" color={palette.muted}>Updated {formatTime(snap.computedAt)}</text>
            <spacer size="medium" />
            <text size="xsmall" color={palette.muted}>Threshold {config.alertThreshold}</text>
          </hstack>

          <hstack gap="small" width="100%">
            {chooserPanel(chooser, snap, panel, data.history ?? [], data.lastAlert, meta.accent, palette, data)}
          </hstack>
        </vstack>
        <vstack width="5%" />
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

function heatmapRow(signal: HeatmapSignal, snap: SignalSnapshot, palette: DashboardPalette): JSX.Element {
  const score = snap[signal.key];
  const activeCells = Math.max(0, Math.min(10, Math.ceil((score / signal.max) * 10)));
  return (
    <hstack gap="small" alignment="middle center" width="100%">
      <text size="xsmall" color={palette.text} weight="bold" width="76px" overflow="ellipsis">{signal.label}</text>
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
      <text size="xsmall" color={palette.muted} width="42px">{score}/{signal.max}</text>
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

function detailPanel(
  panel: DashboardPanel,
  snap: SignalSnapshot,
  history: SignalSnapshot[],
  lastAlert: AlertRecord | null | undefined,
  accent: string,
  palette: DashboardPalette,
): JSX.Element {
  if (panel === 'ops') {
    return (
      <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="100%">
        <text alignment="center" size="xsmall" color={accent} weight="bold">Ops Status</text>
        <hstack alignment="middle center" gap="small" width="100%">
          <vstack alignment="middle center" backgroundColor={palette.panel} cornerRadius="small" padding="small" gap="none" width="50%">
            <text alignment="center" size="xsmall" color={palette.muted}>Last alert</text>
            <text alignment="center" size="small" color={palette.text} weight="bold">{lastAlertText(lastAlert)}</text>
          </vstack>
          <vstack alignment="middle center" backgroundColor={palette.panel} cornerRadius="small" padding="small" gap="none" width="50%">
            <text alignment="center" size="xsmall" color={palette.muted}>Baseline</text>
            <text alignment="center" size="small" color={palette.text} weight="bold">{baselineText(snap)}</text>
          </vstack>
        </hstack>
      </vstack>
    );
  }

  if (panel === 'actions') {
    return (
      <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="100%">
        <text alignment="center" size="xsmall" color={accent} weight="bold">Recommended Action</text>
        <text alignment="center" size="xsmall" color={palette.text}>{recommendedAction(snap)}</text>
      </vstack>
    );
  }

  if (panel === 'explain') {
    return (
      <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="100%">
        <text alignment="center" size="xsmall" color={accent} weight="bold">Score Explanation</text>
        <text alignment="center" size="xsmall" color={palette.text}>{scoreExplanation(snap)}</text>
      </vstack>
    );
  }

  return (
    <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="100%">
      <text alignment="center" size="xsmall" color={accent} weight="bold">Trend - last scans</text>
      {sparkline(history, snap)}
    </vstack>
  );
}

function chooserPanel(
  chooser: DashboardChooser,
  snap: SignalSnapshot,
  panel: DashboardPanel,
  history: SignalSnapshot[],
  lastAlert: AlertRecord | null | undefined,
  accent: string,
  palette: DashboardPalette,
  data: DashboardData,
): JSX.Element {
  if (chooser === 'panel') {
    return (
      <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="none" width="100%">
        <hstack alignment="middle center" gap="small" width="100%">
          <button size="small" appearance="primary" textColor="#ffffff" onPress={() => data.onChoosePanel?.('trend')}>Trend</button>
          <button size="small" appearance="primary" textColor="#ffffff" onPress={() => data.onChoosePanel?.('ops')}>Ops</button>
          <button size="small" appearance="primary" textColor="#ffffff" onPress={() => data.onChoosePanel?.('actions')}>Actions</button>
          <button size="small" appearance="primary" textColor="#ffffff" onPress={() => data.onChoosePanel?.('explain')}>Explain</button>
          <button size="small" appearance="secondary" textColor="#ffffff" onPress={data.onCloseChooser}>Close</button>
        </hstack>
      </vstack>
    );
  }

  return detailPanel(panel, snap, history, lastAlert, accent, palette);
}

function themePanel(palette: DashboardPalette, data: DashboardData): JSX.Element {
  return (
    <vstack padding="medium" gap="small" width="100%" height="100%" backgroundColor={palette.bg}>
      <hstack alignment="middle center" width="100%">
        <vstack gap="none">
          <text size="large" weight="bold" color={palette.accent}>CHOOSE THEME</text>
          <text size="xsmall" color={palette.muted}>Editor-inspired dashboard palettes</text>
        </vstack>
        <spacer size="medium" />
        <button size="small" appearance="secondary" textColor="#ffffff" onPress={data.onCloseChooser}>Close</button>
      </hstack>

      <hstack gap="small" width="100%">
        {themeCard('Ember', 'Default fire console', 'ember', palette, data)}
        {themeCard('Abyss', 'Deep blue terminal', 'abyss', palette, data)}
        {themeCard('Dracula', 'Purple command room', 'dracula', palette, data)}
      </hstack>

      <hstack gap="small" width="100%">
        {themeCard('Andromeda', 'Soft space palette', 'andromeda', palette, data)}
        {themeCard('Night Owl', 'Blue operator mode', 'nightOwl', palette, data)}
        {themeCard('Synth', 'Neon incident board', 'synthwave', palette, data)}
      </hstack>

      <hstack gap="small" width="100%">
        {themeCard('Mono', 'Light mode with black UI', 'mono', palette, data)}
        <vstack width="67%" />
      </hstack>
    </vstack>
  );
}

function themeCard(
  title: string,
  description: string,
  theme: DashboardTheme,
  palette: DashboardPalette,
  data: DashboardData,
): JSX.Element {
  return (
    <vstack backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="33%">
      <text size="small" weight="bold" color={palette.text}>{title}</text>
      <text size="xsmall" color={palette.muted}>{description}</text>
      <button size="small" appearance="primary" textColor="#ffffff" onPress={() => data.onChooseTheme?.(theme)}>Apply</button>
    </vstack>
  );
}

function settingsPanel(
  snap: SignalSnapshot,
  config: EmberConfig,
  lastAlert: AlertRecord | null | undefined,
  palette: DashboardPalette,
  data: DashboardData,
): JSX.Element {
  return (
    <vstack padding="medium" gap="small" width="100%" height="100%" backgroundColor={palette.bg}>
      <hstack alignment="middle center" width="100%">
        <vstack gap="none">
          <text size="large" weight="bold" color={palette.accent}>EMBER SETTINGS</text>
          <text size="xsmall" color={palette.muted}>Install configuration snapshot</text>
        </vstack>
        <spacer size="medium" />
        <button size="small" appearance="primary" textColor="#ffffff" onPress={data.onRefresh}>Refresh</button>
        <spacer size="small" />
        <button size="small" appearance="secondary" textColor="#ffffff" onPress={data.onCloseChooser}>Close</button>
      </hstack>

      <hstack gap="small" width="100%">
        {settingCard('Heat', `${snap.total}/100`, palette)}
        {settingCard('Threshold', `${config.alertThreshold}`, palette)}
        {settingCard('Cooldown', `${config.alertCooldownMinutes} min`, palette)}
        {settingCard('Scan', `${config.scanIntervalMinutes} min`, palette)}
      </hstack>

      <vstack backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="small" width="100%">
        <hstack width="100%" alignment="middle center">
          <text size="xsmall" color={palette.muted}>Alerts muted</text>
          <spacer size="small" />
          <text size="xsmall" weight="bold" color={palette.text}>{config.muteAlerts ? 'Yes' : 'No'}</text>
        </hstack>
        <hstack width="100%" alignment="middle center">
          <text size="xsmall" color={palette.muted}>Last alert</text>
          <spacer size="small" />
          <text size="xsmall" weight="bold" color={palette.text}>{lastAlertText(lastAlert)}</text>
        </hstack>
        <hstack width="100%" alignment="middle center">
          <text size="xsmall" color={palette.muted}>Baseline status</text>
          <spacer size="small" />
          <text size="xsmall" weight="bold" color={palette.text}>{baselineText(snap)}</text>
        </hstack>
      </vstack>

      <vstack backgroundColor={palette.panel} cornerRadius="medium" padding="small" gap="small" width="100%">
        <text size="xsmall" weight="bold" color={palette.accent}>Edit settings</text>
        <text size="xsmall" color={palette.text}>Dashboard settings are read-only here. Change alert threshold, cooldown, scan interval, and mute alerts in Mod Tools - Apps - Ember.</text>
      </vstack>
    </vstack>
  );
}

function settingCard(label: string, value: string, palette: DashboardPalette): JSX.Element {
  return (
    <vstack alignment="middle center" backgroundColor={palette.card} cornerRadius="medium" padding="small" gap="none" width="25%">
      <text alignment="center" size="xsmall" color={palette.muted}>{label}</text>
      <text alignment="center" size="small" weight="bold" color={palette.text}>{value}</text>
    </vstack>
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

function recommendedAction(snap: SignalSnapshot): string {
  if (snap.total >= 75) return 'Lock volatile threads, review reports, and alert the mod team.';
  if (snap.total >= 56) return 'Review active reports and watch fast-moving threads.';
  if (snap.total >= 31) return 'Keep watching. Early warning signals are present.';
  return 'No action needed. Ember will alert mods if heat rises.';
}

function scoreExplanation(snap: SignalSnapshot): string {
  const active = SIGNALS
    .filter((signal) => snap[signal.key] > 0)
    .map((signal) => `${signal.label} ${snap[signal.key]}/${signal.max}`);

  if (active.length === 0) {
    return 'No active risk signals. Reports, removals, new accounts, velocity, and controversy are all quiet.';
  }

  return `Heat is driven by ${active.join(', ')}. Primary risk: ${dominantSignal(snap)}.`;
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

function themePalette(theme: DashboardTheme): DashboardPalette {
  if (theme === 'ember') {
    return {
      bg: '#090604',
      panel: '#1f1208',
      card: '#160d08',
      muted: '#f59e0b',
      text: '#fff7ed',
      accent: '#ff6b35',
    };
  }

  if (theme === 'dracula') {
    return {
      bg: '#171521',
      panel: '#282a36',
      card: '#1f2030',
      muted: '#bd93f9',
      text: '#f8f8f2',
      accent: '#ff79c6',
    };
  }

  if (theme === 'andromeda') {
    return {
      bg: '#141923',
      panel: '#232b3d',
      card: '#1b2233',
      muted: '#a0a1c4',
      text: '#f8f8f2',
      accent: '#c74ded',
    };
  }

  if (theme === 'nightOwl') {
    return {
      bg: '#011627',
      panel: '#0b2942',
      card: '#081f33',
      muted: '#82aaff',
      text: '#d6deeb',
      accent: '#7fdbca',
    };
  }

  if (theme === 'synthwave') {
    return {
      bg: '#1a102d',
      panel: '#2b174f',
      card: '#21133f',
      muted: '#f7aef8',
      text: '#fff5ff',
      accent: '#ff7edb',
    };
  }

  if (theme === 'mono') {
    return {
      bg: '#f4f4f0',
      panel: '#ffffff',
      card: '#e8e8e2',
      muted: '#3f3f46',
      text: '#0a0a0a',
      accent: '#111111',
    };
  }

  return {
    bg: '#050814',
    panel: '#0a1024',
    card: '#0e172f',
    muted: '#6b8cff',
    text: '#d9e6ff',
    accent: '#4cc9f0',
  };
}

export function nextDashboardTheme(theme: DashboardTheme): DashboardTheme {
  if (theme === 'ember') return 'abyss';
  if (theme === 'abyss') return 'dracula';
  if (theme === 'dracula') return 'andromeda';
  if (theme === 'andromeda') return 'nightOwl';
  if (theme === 'nightOwl') return 'synthwave';
  if (theme === 'synthwave') return 'mono';
  return 'ember';
}

export function nextDashboardPanel(panel: DashboardPanel): DashboardPanel {
  if (panel === 'trend') return 'ops';
  if (panel === 'ops') return 'actions';
  if (panel === 'actions') return 'explain';
  return 'trend';
}
