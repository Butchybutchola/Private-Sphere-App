/**
 * Device Information Service
 *
 * Collects device identifiers for forensic metadata.
 * Uses a stable, locally-generated device ID stored in secure storage.
 */

import * as SecureStore from 'expo-secure-store';
import { generateUUID } from '../utils/uuid';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'evidence_guardian_device_id';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = generateUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}

export function getDevicePlatform(): string {
  return `${Platform.OS}/${Platform.Version}`;
}

export function getAppVersion(): string {
  return '1.0.0-mvp';
}
