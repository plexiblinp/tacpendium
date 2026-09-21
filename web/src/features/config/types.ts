export interface NetworkInfo {
  primaryLanIp: string;
  lanUrl: string;
}

export interface DefaultsInfo {
  characterId: number;
  presetId: number;
}

export interface ConfigResponse {
  server: {
    mode: string;
    port: number;
  };
  database: {
    path: string;
  };
  logging: {
    level: string;
    file: string;
    maxSizeMb: number;
    maxBackups: number;
    maxAgeDays: number;
  };
  security: {
    passwordEnabled: boolean;
  };
  network: NetworkInfo;
  defaults: DefaultsInfo;
  isInitialized: boolean;
  restartRequired: boolean;
}

export interface UpdateConfigRequest {
  server?: {
    mode?: string;
    port?: number;
  };
  database?: {
    path?: string;
  };
  logging?: {
    level?: string;
    file?: string;
    maxSizeMb?: number;
    maxBackups?: number;
    maxAgeDays?: number;
  };
  security?: {
    passwordEnabled?: boolean;
  };
  defaults?: {
    characterId?: number;
    presetId?: number;
  };
}
