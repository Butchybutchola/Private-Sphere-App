import { getDatabase } from './db';
import { UserProfile, OtherParty, Child, AustralianState } from '../types';
import uuid from 'react-native-uuid';
import { encryptString, decryptString } from '../services/encryptionService';

// Sensitive fields encrypted at rest (AES-256-GCM via encryptionService).
// state/postcode are lower-risk but encrypting them is consistent and cheap.

// ---- User Profile ----

export async function saveUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO user_profiles (id, first_name, last_name, date_of_birth, email, phone, address, suburb, state, postcode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    await encryptString(profile.firstName),
    await encryptString(profile.lastName),
    await encryptString(profile.dateOfBirth),
    await encryptString(profile.email),
    await encryptString(profile.phone),
    await encryptString(profile.address),
    await encryptString(profile.suburb),
    await encryptString(profile.state),
    await encryptString(profile.postcode),
    now, now
  );

  return { id, ...profile, createdAt: now, updatedAt: now };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM user_profiles LIMIT 1');
  if (!row) return null;
  return mapUserProfile(row);
}

export async function updateUserProfile(id: string, updates: Partial<UserProfile>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  const encryptedFields = new Set([
    'firstName', 'lastName', 'dateOfBirth', 'email', 'phone', 'address', 'suburb', 'state', 'postcode',
  ]);

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    email: 'email', phone: 'phone', address: 'address', suburb: 'suburb',
    state: 'state', postcode: 'postcode',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      const raw = (updates as Record<string, string | number | boolean | null>)[key];
      const val = encryptedFields.has(key) && typeof raw === 'string'
        ? await encryptString(raw)
        : raw;
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await db.runAsync(`UPDATE user_profiles SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

async function mapUserProfile(row: Record<string, unknown>): Promise<UserProfile> {
  return {
    id: row.id as string,
    firstName: await decryptString(row.first_name as string),
    lastName: await decryptString(row.last_name as string),
    dateOfBirth: await decryptString(row.date_of_birth as string),
    email: await decryptString(row.email as string),
    phone: await decryptString(row.phone as string),
    address: await decryptString(row.address as string),
    suburb: await decryptString(row.suburb as string),
    state: await decryptString(row.state as string) as AustralianState,
    postcode: await decryptString(row.postcode as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- Other Party ----

export async function addOtherParty(party: Omit<OtherParty, 'id' | 'createdAt' | 'updatedAt'>): Promise<OtherParty> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO other_parties (id, user_id, first_name, last_name, date_of_birth, phone, address, suburb, state, postcode, relationship, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, party.userId,
    await encryptString(party.firstName),
    await encryptString(party.lastName),
    party.dateOfBirth ? await encryptString(party.dateOfBirth) : null,
    party.phone ? await encryptString(party.phone) : null,
    party.address ? await encryptString(party.address) : null,
    party.suburb ? await encryptString(party.suburb) : null,
    party.state ? await encryptString(party.state) : null,
    party.postcode ? await encryptString(party.postcode) : null,
    await encryptString(party.relationship),
    party.notes ? await encryptString(party.notes) : null,
    now, now
  );

  return { id, ...party, createdAt: now, updatedAt: now };
}

export async function getOtherParties(userId: string): Promise<OtherParty[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM other_parties WHERE user_id = ? ORDER BY created_at DESC', userId
  );
  return Promise.all(rows.map(mapOtherParty));
}

export async function updateOtherParty(id: string, updates: Partial<OtherParty>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  const encryptedFields = new Set([
    'firstName', 'lastName', 'dateOfBirth', 'phone', 'address', 'suburb', 'state', 'postcode', 'relationship', 'notes',
  ]);

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    phone: 'phone', address: 'address', suburb: 'suburb', state: 'state',
    postcode: 'postcode', relationship: 'relationship', notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      const raw = (updates as Record<string, string | number | boolean | null>)[key];
      const val = encryptedFields.has(key) && typeof raw === 'string'
        ? await encryptString(raw)
        : raw;
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await db.runAsync(`UPDATE other_parties SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteOtherParty(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM other_parties WHERE id = ?', id);
}

async function mapOtherParty(row: Record<string, unknown>): Promise<OtherParty> {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: await decryptString(row.first_name as string),
    lastName: await decryptString(row.last_name as string),
    dateOfBirth: row.date_of_birth ? await decryptString(row.date_of_birth as string) : undefined,
    phone: row.phone ? await decryptString(row.phone as string) : undefined,
    address: row.address ? await decryptString(row.address as string) : undefined,
    suburb: row.suburb ? await decryptString(row.suburb as string) : undefined,
    state: row.state ? await decryptString(row.state as string) as AustralianState : undefined,
    postcode: row.postcode ? await decryptString(row.postcode as string) : undefined,
    relationship: await decryptString(row.relationship as string),
    notes: row.notes ? await decryptString(row.notes as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- Children ----

export async function addChild(child: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>): Promise<Child> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO children (id, user_id, first_name, last_name, date_of_birth, lives_with_user, custody_arrangement, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, child.userId,
    await encryptString(child.firstName),
    await encryptString(child.lastName),
    await encryptString(child.dateOfBirth),
    child.livesWithUser ? 1 : 0,
    child.custodyArrangement ? await encryptString(child.custodyArrangement) : null,
    child.notes ? await encryptString(child.notes) : null,
    now, now
  );

  return { id, ...child, createdAt: now, updatedAt: now };
}

export async function getChildren(userId: string): Promise<Child[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM children WHERE user_id = ? ORDER BY date_of_birth ASC', userId
  );
  return Promise.all(rows.map(mapChild));
}

export async function updateChild(id: string, updates: Partial<Child>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  const encryptedFields = new Set(['firstName', 'lastName', 'dateOfBirth', 'custodyArrangement', 'notes']);

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    livesWithUser: 'lives_with_user', custodyArrangement: 'custody_arrangement', notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      let raw: string | number | boolean | null = (updates as Record<string, string | number | boolean | null>)[key];
      if (key === 'livesWithUser') {
        raw = raw ? 1 : 0;
        fields.push(`${col} = ?`);
        values.push(raw);
      } else {
        const val = encryptedFields.has(key) && typeof raw === 'string'
          ? await encryptString(raw)
          : raw;
        fields.push(`${col} = ?`);
        values.push(val);
      }
    }
  }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await db.runAsync(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteChild(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM children WHERE id = ?', id);
}

async function mapChild(row: Record<string, unknown>): Promise<Child> {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: await decryptString(row.first_name as string),
    lastName: await decryptString(row.last_name as string),
    dateOfBirth: await decryptString(row.date_of_birth as string),
    livesWithUser: row.lives_with_user === 1,
    custodyArrangement: row.custody_arrangement ? await decryptString(row.custody_arrangement as string) : undefined,
    notes: row.notes ? await decryptString(row.notes as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
