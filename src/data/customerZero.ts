import type { Atlas, Profile, ProfileId } from '../domain'

export const CUSTOMER_ZERO_ATLAS: Atlas = {
  id: 'customer-zero-family',
  type: 'family',
  name: 'Our Family Travel Map',
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
}

export const CUSTOMER_ZERO_PROFILES: Profile[] = [
  { id: 'mum', profileKey: 'mum', atlasId: CUSTOMER_ZERO_ATLAS.id, name: 'Mum', mapColour: '#4fb6a1', role: 'admin' },
  { id: 'dad', profileKey: 'dad', atlasId: CUSTOMER_ZERO_ATLAS.id, name: 'Dad', mapColour: '#4f86c6', role: 'admin' },
  { id: 'amelia', profileKey: 'amelia', atlasId: CUSTOMER_ZERO_ATLAS.id, name: 'Amelia', mapColour: '#d95d5d', role: 'member' },
  { id: 'dylan', profileKey: 'dylan', atlasId: CUSTOMER_ZERO_ATLAS.id, name: 'Dylan', mapColour: '#e59a4a', role: 'child' },
  { id: 'cian', profileKey: 'cian', atlasId: CUSTOMER_ZERO_ATLAS.id, name: 'Cian', mapColour: '#8b6bb1', role: 'child' },
]

export function isCustomerZeroProfileId(value: string): value is ProfileId {
  return CUSTOMER_ZERO_PROFILES.some((profile) => profile.id === value)
}