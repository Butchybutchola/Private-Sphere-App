/**
 * Tests for userProfileRepository.ts
 *
 * Verifies that PII is encrypted on write and decrypted on read for
 * UserProfile, OtherParty, and Child entities.
 */

// ─── Mock registrations ───────────────────────────────────────────────────────

jest.mock('../../database/db', () => ({ getDatabase: jest.fn() }));

jest.mock('react-native-uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('../../services/encryptionService', () => ({
  encryptString: jest.fn(async (v: string) => `enc(${v})`),
  decryptString: jest.fn(async (v: string) => v.replace(/^enc\(/, '').replace(/\)$/, '')),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getDatabase } from '../../database/db';
import uuid from 'react-native-uuid';
import { encryptString, decryptString } from '../../services/encryptionService';
import {
  saveUserProfile,
  getUserProfile,
  updateUserProfile,
  addOtherParty,
  getOtherParties,
  updateOtherParty,
  deleteOtherParty,
  addChild,
  getChildren,
  updateChild,
  deleteChild,
} from '../../database/userProfileRepository';

// ─── Shared state ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
let profileRows: Row[] = [];
let partyRows: Row[] = [];
let childRows: Row[] = [];
let uuidCounter = 0;

const mockRunAsync    = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync   = jest.fn();

function buildDb(): void {
  mockRunAsync.mockImplementation(async (sql: string, ...params: unknown[]) => {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('INSERT INTO USER_PROFILES')) {
      const [id, fn, ln, dob, email, phone, addr, suburb, state, postcode, ca, ua] = params;
      profileRows.push({ id, first_name: fn, last_name: ln, date_of_birth: dob, email, phone, address: addr, suburb, state, postcode, created_at: ca, updated_at: ua });
    } else if (upper.startsWith('UPDATE USER_PROFILES')) {
      // apply generic update to first row
      if (profileRows[0]) profileRows[0].updated_at = params[params.length - 2] as string;
    } else if (upper.startsWith('INSERT INTO OTHER_PARTIES')) {
      const [id, uid, fn, ln, dob, phone, addr, suburb, state, postcode, rel, notes, ca, ua] = params;
      partyRows.push({ id, user_id: uid, first_name: fn, last_name: ln, date_of_birth: dob, phone, address: addr, suburb, state, postcode, relationship: rel, notes, created_at: ca, updated_at: ua });
    } else if (upper.startsWith('UPDATE OTHER_PARTIES')) {
      if (partyRows[0]) partyRows[0].updated_at = params[params.length - 2] as string;
    } else if (upper.startsWith('DELETE FROM OTHER_PARTIES')) {
      const targetId = params[0] as string;
      partyRows = partyRows.filter(r => r.id !== targetId);
    } else if (upper.startsWith('INSERT INTO CHILDREN')) {
      const [id, uid, fn, ln, dob, lwu, ca_arr, notes, ca, ua] = params;
      childRows.push({ id, user_id: uid, first_name: fn, last_name: ln, date_of_birth: dob, lives_with_user: lwu, custody_arrangement: ca_arr, notes, created_at: ca, updated_at: ua });
    } else if (upper.startsWith('UPDATE CHILDREN')) {
      if (childRows[0]) childRows[0].updated_at = params[params.length - 2] as string;
    } else if (upper.startsWith('DELETE FROM CHILDREN')) {
      const targetId = params[0] as string;
      childRows = childRows.filter(r => r.id !== targetId);
    }
  });

  mockGetFirstAsync.mockImplementation(async (sql: string) => {
    if (sql.includes('user_profiles')) return profileRows[0] ?? null;
    return null;
  });

  mockGetAllAsync.mockImplementation(async (sql: string) => {
    if (sql.includes('other_parties')) return [...partyRows];
    if (sql.includes('children')) return [...childRows];
    return [];
  });

  (getDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
  });
}

beforeEach(() => {
  profileRows = [];
  partyRows = [];
  childRows = [];
  uuidCounter = 0;
  jest.clearAllMocks();
  (uuid.v4 as jest.Mock).mockImplementation(() => `uuid-${++uuidCounter}`);
  (encryptString as jest.Mock).mockImplementation(async (v: string) => `enc(${v})`);
  (decryptString as jest.Mock).mockImplementation(async (v: string) => v.replace(/^enc\(/, '').replace(/\)$/, ''));
  buildDb();
});

// ─── UserProfile — encrypt on save ───────────────────────────────────────────

describe('saveUserProfile', () => {
  const profile = {
    firstName: 'Jane', lastName: 'Smith', dateOfBirth: '1985-06-15',
    email: 'jane@example.com', phone: '0412345678',
    address: '12 Safe St', suburb: 'Shelter', state: 'VIC' as const, postcode: '3000',
  };

  it('returns the plaintext profile (not ciphertext)', async () => {
    const saved = await saveUserProfile(profile);
    expect(saved.firstName).toBe('Jane');
    expect(saved.email).toBe('jane@example.com');
  });

  it('persists ciphertext to the database', async () => {
    await saveUserProfile(profile);
    expect(profileRows[0].first_name).toBe('enc(Jane)');
    expect(profileRows[0].last_name).toBe('enc(Smith)');
    expect(profileRows[0].email).toBe('enc(jane@example.com)');
    expect(profileRows[0].phone).toBe('enc(0412345678)');
    expect(profileRows[0].address).toBe('enc(12 Safe St)');
    expect(profileRows[0].suburb).toBe('enc(Shelter)');
    expect(profileRows[0].state).toBe('enc(VIC)');
    expect(profileRows[0].postcode).toBe('enc(3000)');
  });

  it('encrypts every sensitive field exactly once each', async () => {
    await saveUserProfile(profile);
    // 9 sensitive fields: firstName, lastName, dateOfBirth, email, phone, address, suburb, state, postcode
    expect(encryptString).toHaveBeenCalledTimes(9);
  });
});

// ─── UserProfile — decrypt on read ───────────────────────────────────────────

describe('getUserProfile', () => {
  it('decrypts fields when reading', async () => {
    profileRows.push({
      id: 'p-1', first_name: 'enc(Jane)', last_name: 'enc(Smith)',
      date_of_birth: 'enc(1985-06-15)', email: 'enc(jane@example.com)',
      phone: 'enc(0412)', address: 'enc(12 Safe St)', suburb: 'enc(Shelter)',
      state: 'enc(VIC)', postcode: 'enc(3000)',
      created_at: '2024-01-01', updated_at: '2024-01-01',
    });

    const result = await getUserProfile();
    expect(result).not.toBeNull();
    expect(result!.firstName).toBe('Jane');
    expect(result!.lastName).toBe('Smith');
    expect(result!.email).toBe('jane@example.com');
    expect(result!.state).toBe('VIC');
  });

  it('returns null when no profile exists', async () => {
    const result = await getUserProfile();
    expect(result).toBeNull();
  });

  it('calls decryptString for each sensitive field', async () => {
    profileRows.push({
      id: 'p-1', first_name: 'enc(A)', last_name: 'enc(B)',
      date_of_birth: 'enc(C)', email: 'enc(D)', phone: 'enc(E)',
      address: 'enc(F)', suburb: 'enc(G)', state: 'enc(H)', postcode: 'enc(I)',
      created_at: '2024-01-01', updated_at: '2024-01-01',
    });
    await getUserProfile();
    expect(decryptString).toHaveBeenCalledTimes(9); // all 9 encrypted fields
  });
});

// ─── UserProfile — update encrypts new values ────────────────────────────────

describe('updateUserProfile', () => {
  it('encrypts string fields before writing to DB', async () => {
    await updateUserProfile('p-1', { firstName: 'NewName', email: 'new@test.com' });
    // Check that encryptString was called with the new plaintext values
    expect(encryptString).toHaveBeenCalledWith('NewName');
    expect(encryptString).toHaveBeenCalledWith('new@test.com');
  });

  it('does nothing when updates object is empty', async () => {
    await updateUserProfile('p-1', {});
    expect(mockRunAsync).not.toHaveBeenCalled();
  });
});

// ─── OtherParty — encrypt on save ────────────────────────────────────────────

describe('addOtherParty', () => {
  const party = {
    userId: 'user-1', firstName: 'John', lastName: 'Doe',
    relationship: 'Former partner',
    dateOfBirth: '1980-01-01', phone: '0400000000',
    address: '99 Bad Rd', suburb: 'Danger', state: 'NSW' as const, postcode: '2000',
    notes: 'Restraining order in place',
  };

  it('returns the plaintext party object', async () => {
    const saved = await addOtherParty(party);
    expect(saved.firstName).toBe('John');
    expect(saved.relationship).toBe('Former partner');
    expect(saved.notes).toBe('Restraining order in place');
  });

  it('stores ciphertext in the database', async () => {
    await addOtherParty(party);
    expect(partyRows[0].first_name).toBe('enc(John)');
    expect(partyRows[0].last_name).toBe('enc(Doe)');
    expect(partyRows[0].relationship).toBe('enc(Former partner)');
    expect(partyRows[0].notes).toBe('enc(Restraining order in place)');
    expect(partyRows[0].phone).toBe('enc(0400000000)');
    expect(partyRows[0].address).toBe('enc(99 Bad Rd)');
  });

  it('stores null for absent optional fields', async () => {
    const minimalParty = { userId: 'user-1', firstName: 'X', lastName: 'Y', relationship: 'sibling' };
    await addOtherParty(minimalParty);
    expect(partyRows[0].date_of_birth).toBeNull();
    expect(partyRows[0].phone).toBeNull();
    expect(partyRows[0].notes).toBeNull();
  });
});

// ─── OtherParty — decrypt on read ────────────────────────────────────────────

describe('getOtherParties', () => {
  it('decrypts all fields', async () => {
    partyRows.push({
      id: 'op-1', user_id: 'user-1',
      first_name: 'enc(John)', last_name: 'enc(Doe)',
      date_of_birth: null, phone: 'enc(0400000000)',
      address: null, suburb: null, state: null, postcode: null,
      relationship: 'enc(Former partner)', notes: 'enc(RO in place)',
      created_at: '2024-01-01', updated_at: '2024-01-01',
    });

    const [result] = await getOtherParties('user-1');
    expect(result.firstName).toBe('John');
    expect(result.relationship).toBe('Former partner');
    expect(result.notes).toBe('RO in place');
    expect(result.phone).toBe('0400000000');
    expect(result.dateOfBirth).toBeUndefined();
  });
});

// ─── OtherParty — update ─────────────────────────────────────────────────────

describe('updateOtherParty', () => {
  it('encrypts string fields before writing', async () => {
    await updateOtherParty('op-1', { notes: 'Updated note' });
    expect(encryptString).toHaveBeenCalledWith('Updated note');
  });
});

// ─── OtherParty — delete ─────────────────────────────────────────────────────

describe('deleteOtherParty', () => {
  it('removes the party row', async () => {
    partyRows.push({ id: 'op-1', user_id: 'user-1', first_name: 'enc(X)', last_name: 'enc(Y)', relationship: 'enc(R)', created_at: '2024-01-01', updated_at: '2024-01-01' });
    await deleteOtherParty('op-1');
    expect(partyRows).toHaveLength(0);
  });
});

// ─── Child — encrypt on save ──────────────────────────────────────────────────

describe('addChild', () => {
  const child = {
    userId: 'user-1', firstName: 'Alice', lastName: 'Smith',
    dateOfBirth: '2015-03-20', livesWithUser: true,
    custodyArrangement: 'Week on/week off', notes: 'Attends primary school',
  };

  it('returns the plaintext child object', async () => {
    const saved = await addChild(child);
    expect(saved.firstName).toBe('Alice');
    expect(saved.livesWithUser).toBe(true);
  });

  it('stores ciphertext in the database', async () => {
    await addChild(child);
    expect(childRows[0].first_name).toBe('enc(Alice)');
    expect(childRows[0].last_name).toBe('enc(Smith)');
    expect(childRows[0].date_of_birth).toBe('enc(2015-03-20)');
    expect(childRows[0].custody_arrangement).toBe('enc(Week on/week off)');
    expect(childRows[0].notes).toBe('enc(Attends primary school)');
  });

  it('stores livesWithUser as a SQLite integer (1/0)', async () => {
    await addChild(child);
    expect(childRows[0].lives_with_user).toBe(1);

    await addChild({ ...child, livesWithUser: false });
    expect(childRows[1].lives_with_user).toBe(0);
  });

  it('stores null for absent optional fields', async () => {
    await addChild({ userId: 'user-1', firstName: 'B', lastName: 'C', dateOfBirth: '2018-01-01', livesWithUser: false });
    expect(childRows[0].custody_arrangement).toBeNull();
    expect(childRows[0].notes).toBeNull();
  });
});

// ─── Child — decrypt on read ──────────────────────────────────────────────────

describe('getChildren', () => {
  it('decrypts all encrypted fields', async () => {
    childRows.push({
      id: 'ch-1', user_id: 'user-1',
      first_name: 'enc(Alice)', last_name: 'enc(Smith)',
      date_of_birth: 'enc(2015-03-20)', lives_with_user: 1,
      custody_arrangement: 'enc(Week on/week off)', notes: null,
      created_at: '2024-01-01', updated_at: '2024-01-01',
    });

    const [result] = await getChildren('user-1');
    expect(result.firstName).toBe('Alice');
    expect(result.dateOfBirth).toBe('2015-03-20');
    expect(result.livesWithUser).toBe(true);
    expect(result.custodyArrangement).toBe('Week on/week off');
    expect(result.notes).toBeUndefined();
  });
});

// ─── Child — update ───────────────────────────────────────────────────────────

describe('updateChild', () => {
  it('encrypts string fields before writing', async () => {
    await updateChild('ch-1', { firstName: 'Bob', custodyArrangement: 'Full custody' });
    expect(encryptString).toHaveBeenCalledWith('Bob');
    expect(encryptString).toHaveBeenCalledWith('Full custody');
  });

  it('converts livesWithUser boolean to 1/0 without encrypting', async () => {
    await updateChild('ch-1', { livesWithUser: false });
    // Should not try to encrypt a boolean
    expect(encryptString).not.toHaveBeenCalled();
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('lives_with_user'),
      0, expect.any(String), 'ch-1'
    );
  });
});

// ─── Child — delete ───────────────────────────────────────────────────────────

describe('deleteChild', () => {
  it('removes the child row', async () => {
    childRows.push({ id: 'ch-1', user_id: 'user-1', first_name: 'enc(X)', last_name: 'enc(Y)', date_of_birth: 'enc(Z)', lives_with_user: 0, custody_arrangement: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01' });
    await deleteChild('ch-1');
    expect(childRows).toHaveLength(0);
  });
});
