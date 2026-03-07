import { getDatabase } from './db';
import { UserProfile, OtherParty, Child, AustralianState } from '../types';
import uuid from 'react-native-uuid';

// ---- User Profile ----

export async function saveUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO user_profiles (id, first_name, last_name, date_of_birth, email, phone, address, suburb, state, postcode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, profile.firstName, profile.lastName, profile.dateOfBirth,
    profile.email, profile.phone, profile.address, profile.suburb,
    profile.state, profile.postcode, now, now
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

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    email: 'email', phone: 'phone', address: 'address', suburb: 'suburb',
    state: 'state', postcode: 'postcode',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      values.push((updates as Record<string, string | number | boolean | null>)[key]);
    }
  }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await db.runAsync(`UPDATE user_profiles SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string,
    email: row.email as string,
    phone: row.phone as string,
    address: row.address as string,
    suburb: row.suburb as string,
    state: row.state as AustralianState,
    postcode: row.postcode as string,
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
    id, party.userId, party.firstName, party.lastName,
    party.dateOfBirth || null, party.phone || null, party.address || null,
    party.suburb || null, party.state || null, party.postcode || null,
    party.relationship, party.notes || null, now, now
  );

  return { id, ...party, createdAt: now, updatedAt: now };
}

export async function getOtherParties(userId: string): Promise<OtherParty[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM other_parties WHERE user_id = ? ORDER BY created_at DESC', userId
  );
  return rows.map(mapOtherParty);
}

export async function updateOtherParty(id: string, updates: Partial<OtherParty>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    phone: 'phone', address: 'address', suburb: 'suburb', state: 'state',
    postcode: 'postcode', relationship: 'relationship', notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      values.push((updates as Record<string, string | number | boolean | null>)[key]);
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

function mapOtherParty(row: Record<string, unknown>): OtherParty {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string | undefined,
    phone: row.phone as string | undefined,
    address: row.address as string | undefined,
    suburb: row.suburb as string | undefined,
    state: row.state as AustralianState | undefined,
    postcode: row.postcode as string | undefined,
    relationship: row.relationship as string,
    notes: row.notes as string | undefined,
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
    id, child.userId, child.firstName, child.lastName,
    child.dateOfBirth, child.livesWithUser ? 1 : 0,
    child.custodyArrangement || null, child.notes || null, now, now
  );

  return { id, ...child, createdAt: now, updatedAt: now };
}

export async function getChildren(userId: string): Promise<Child[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM children WHERE user_id = ? ORDER BY date_of_birth ASC', userId
  );
  return rows.map(mapChild);
}

export async function updateChild(id: string, updates: Partial<Child>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  const fieldMap: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', dateOfBirth: 'date_of_birth',
    livesWithUser: 'lives_with_user', custodyArrangement: 'custody_arrangement', notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      let val: string | number | boolean | null = (updates as Record<string, string | number | boolean | null>)[key];
      if (key === 'livesWithUser') val = val ? 1 : 0;
      fields.push(`${col} = ?`);
      values.push(val);
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

function mapChild(row: Record<string, unknown>): Child {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string,
    livesWithUser: row.lives_with_user === 1,
    custodyArrangement: row.custody_arrangement as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
