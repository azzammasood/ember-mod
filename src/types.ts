export type HeatLevel = 'cool' | 'warming' | 'hot' | 'ember';

export interface SignalSnapshot {
  reportSpike: number;
  removalSurge: number;
  newAccountFlood: number;
  velocitySpike: number;
  controversyCluster: number;
  total: number;
  level: HeatLevel;
  computedAt: number;
}

export interface RollingWindow {
  reportTimestamps: number[];
  commentTimestamps: number[];
  removalTimestamps: number[];
  newAccountComments: number[];
  controversialPosts: number[];
}

export interface AlertRecord {
  firedAt: number;
  heatScore: number;
  level: HeatLevel;
  snapshot: SignalSnapshot;
}

export interface ActivityStats {
  comments10m: number;
  comments30m: number;
  comments24h: number;
  removals30m: number;
  reports60m: number;
  newAccounts20m: number;
  controversial60m: number;
}

export interface EmberConfig {
  alertThreshold: number;
  alertCooldownMinutes: number;
  scanIntervalMinutes: number;
  muteAlerts: boolean;
}

export type EmberSettings = {
  'alert-threshold'?: number;
  'alert-cooldown-minutes'?: number;
  'scan-interval-minutes'?: number;
  'mute-alerts'?: boolean;
};
