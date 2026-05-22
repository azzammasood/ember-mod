import { getLastAlert, saveLastAlert } from './signalStore.js';
import type { EmberConfig, HeatLevel, SignalSnapshot } from './types.js';

const FLAME = '\u{1F525}';
const GREEN = '\u{1F7E2}';
const YELLOW = '\u{1F7E1}';
const ORANGE = '\u{1F7E0}';
const RED = '\u{1F534}';
const CHART = '\u{1F4CA}';
const TRASH = '\u{1F5D1}\uFE0F';
const USER = '\u{1F464}';
const BOLT = '\u26A1';
const SWORDS = '\u2694\uFE0F';

const LEVEL_META: Record<HeatLevel, { emoji: string; label: string }> = {
  cool: { emoji: GREEN, label: 'All Clear' },
  warming: { emoji: YELLOW, label: 'Warming Up' },
  hot: { emoji: ORANGE, label: 'Getting Hot' },
  ember: { emoji: RED, label: 'Act Now' },
};

export async function maybeSendAlert(
  snap: SignalSnapshot,
  config: EmberConfig,
  kvStore: any,
  reddit: any,
  subredditName: string,
): Promise<void> {
  try {
    if (config.muteAlerts) return;
    if (config.alertThreshold <= 0) return;
    if (snap.total < config.alertThreshold) return;

    const lastAlert = await getLastAlert(kvStore);
    const cooldownMs = config.alertCooldownMinutes * 60 * 1000;
    if (lastAlert && Date.now() - lastAlert.firedAt < cooldownMs) return;

    await reddit.modMail.createConversation({
      subredditName,
      subject: `${FLAME} Ember Alert - Heat Score ${snap.total}/100 [${snap.level.toUpperCase()}]`,
      body: formatAlertBody(snap),
      isAuthorHidden: true,
      to: null,
    });

    await saveLastAlert(kvStore, {
      firedAt: Date.now(),
      heatScore: snap.total,
      level: snap.level,
      snapshot: snap,
    });
  } catch (error) {
    console.error('[Ember] alerter.maybeSendAlert failed:', error);
  }
}

function formatAlertBody(snap: SignalSnapshot): string {
  const meta = LEVEL_META[snap.level];
  return [
    `${FLAME} **Ember Heat Alert**`,
    '',
    '---',
    '',
    `**Heat Score: ${snap.total}/100** - ${meta.emoji} ${meta.label}`,
    '',
    `Detected at: ${new Date(snap.computedAt).toUTCString()}`,
    '',
    '**Signal Breakdown:**',
    '',
    `- ${CHART} Report spike: ${snap.reportSpike}/30 pts`,
    `- ${TRASH} Removal surge: ${snap.removalSurge}/25 pts`,
    `- ${USER} New account flood: ${snap.newAccountFlood}/20 pts`,
    `- ${BOLT} Velocity spike: ${snap.velocitySpike}/15 pts`,
    `- ${SWORDS} Controversy cluster: ${snap.controversyCluster}/10 pts`,
    '',
    '**Suggested actions:**',
    '',
    suggestedActions(snap.total),
    '',
    '---',
    '',
    '*Ember - spots the spark before your community catches fire.*',
    '',
    '*Adjust threshold in mod settings: Mod Tools > Apps > Ember*',
  ].join('\n');
}

function suggestedActions(total: number): string {
  if (total >= 75) {
    return [
      '- Consider locking high-controversy threads',
      '- Increase AutoMod sensitivity temporarily',
      '- Alert the full mod team',
    ].join('\n');
  }

  if (total >= 56) {
    return ['- Monitor active threads closely', '- Review recent reports in the mod queue'].join('\n');
  }

  if (total >= 31) {
    return '- No action needed yet - just a heads up';
  }

  return [
    '- Alert threshold was crossed, but the heat level is still Cool.',
    '- No action needed unless this is a deliberate test threshold.',
  ].join('\n');
}
