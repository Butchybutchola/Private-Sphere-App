/**
 * Recording Consent Utility
 *
 * Australian recording consent laws vary significantly by state. This module
 * presents the legally-required warning dialogs before any audio or video
 * capture and returns whether the user confirmed they may proceed.
 *
 * Source: Evidence Guardian spec v2.0 — Recording Consent Laws by State
 *
 * All-party consent required: VIC, TAS, ACT
 * One-party consent: QLD, NSW, WA, SA, NT
 */

import { Alert } from 'react-native';
import { AustralianState } from '../types';

const ALL_PARTY_STATES: AustralianState[] = ['VIC', 'TAS', 'ACT'];

const ALL_PARTY_LEGISLATION: Partial<Record<AustralianState, string>> = {
  VIC: 'Surveillance Devices Act 1999 (Vic), s6',
  TAS: 'Listening Devices Act 1991 (Tas), s5',
  ACT: 'Listening Devices Act 1992 (ACT), s4',
};

const ONE_PARTY_LEGISLATION: Partial<Record<AustralianState, string>> = {
  QLD: 'Invasion of Privacy Act 1971 (Qld), s43',
  NSW: 'Surveillance Devices Act 2007 (NSW), s7',
  WA: 'Surveillance Devices Act 1998 (WA), s5',
  SA: 'Surveillance Devices Act 2016 (SA), s4',
  NT: 'Surveillance Devices Act 2007 (NT), s11',
};

/**
 * Displays the jurisdiction-appropriate consent warning before recording.
 * @param state - User's Australian state from their profile (or undefined if
 *                no profile has been set up yet).
 * @param mediaType - 'audio' or 'video', used in the dialog copy.
 * @returns Promise<boolean> — true if the user confirmed, false if cancelled.
 */
export function checkRecordingConsent(
  state: AustralianState | undefined,
  mediaType: 'audio' | 'video' = 'audio'
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (state && ALL_PARTY_STATES.includes(state)) {
      const legislation = ALL_PARTY_LEGISLATION[state] ?? `${state} recording law`;
      Alert.alert(
        '⚠️ All-Party Consent Required',
        `${state} law (${legislation}) requires ALL parties to a private conversation ` +
        `to consent before it is recorded. Recording without all-party consent ` +
        `may be inadmissible in court and could expose you to criminal liability.\n\n` +
        `Do you have the explicit consent of all parties to this ${mediaType} recording?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'All Parties Have Consented — Record', onPress: () => resolve(true) },
        ]
      );
    } else if (state) {
      const legislation = ONE_PARTY_LEGISLATION[state];
      const legislationNote = legislation ? `\n\n${legislation} permits recording of conversations you are a party to.` : '';
      Alert.alert(
        'Recording Notice',
        `You are about to capture ${mediaType} evidence. Your state (${state}) applies ` +
        `one-party consent, meaning you may record conversations you are directly ` +
        `involved in.${legislationNote}\n\nThis recording will be forensically hardened and locked immediately.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Record', onPress: () => resolve(true) },
        ]
      );
    } else {
      // No profile set up — default to the cautious combined notice
      Alert.alert(
        'Recording Laws Notice',
        `Recording consent laws vary across Australian states:\n\n` +
        `• VIC, TAS, ACT: All-party consent is required\n` +
        `• QLD, NSW, WA, SA, NT: One-party consent applies\n\n` +
        `You can set your state in your Profile to receive specific legal guidance ` +
        `before recording. Ensure you comply with the laws in your jurisdiction.\n\n` +
        `Do you wish to proceed with this ${mediaType} recording?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'I Understand — Record', onPress: () => resolve(true) },
        ]
      );
    }
  });
}
