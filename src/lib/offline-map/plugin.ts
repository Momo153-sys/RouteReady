
import { registerPlugin } from '@capacitor/core';

export interface OfflineMapInstallResult {
  path: string;
  installed: boolean;
}

export interface OfflineMapPlugin {
  install(): Promise<OfflineMapInstallResult>;
}

export const OfflineMap = registerPlugin<OfflineMapPlugin>('OfflineMap');
