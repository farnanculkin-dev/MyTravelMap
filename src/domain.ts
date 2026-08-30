export type AtlasType = 'family' | 'individual'

export type ProfileRole = 'admin' | 'member' | 'child'

export interface Atlas {
  id: string
  type: AtlasType
  name: string
  groupPhotoUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  personId?: string
  profileKey?: string
  atlasId: string
  name: string
  photoUrl?: string
  mapColour: string
  role: ProfileRole
}

export interface ProfileTravel {
  profileId: string
  visitedCountryIds: string[]
}

export interface TripParticipant {
  personId: string
  displayName: string
}

export interface Trip {
  id: string
  atlasId: string
  ownerPersonId: string
  title: string
  startDate?: string
  endDate?: string
  description?: string
  coverPhotoUrl?: string
  visibility: 'atlas' | 'private'
  participantIds: string[]
  participantNames: string[]
  countryIds: string[]
  createdAt: string
  updatedAt: string
}

export type ProfileId = 'mum' | 'dad' | 'amelia' | 'dylan' | 'cian'
