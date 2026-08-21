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

export type ProfileId = 'mum' | 'dad' | 'amelia' | 'dylan' | 'cian'