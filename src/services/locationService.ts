/**
 * Location Service
 *
 * Captures GPS coordinates at the point of evidence capture.
 * Provides high-accuracy location data for forensic metadata.
 */

import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}

let permissionGranted = false;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  permissionGranted = status === 'granted';
  return permissionGranted;
}

export async function getCurrentLocation(): Promise<LocationData | null> {
  if (!permissionGranted) {
    const granted = await requestLocationPermission();
    if (!granted) return null;
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export async function getLocationAddress(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!address) return null;

    const parts = [
      address.street,
      address.city,
      address.region,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  } catch {
    return null;
  }
}
