import React, { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import AtlasSetupScreen from './components/AtlasSetupScreen'
import CustomerZeroMigrationPanel from './components/CustomerZeroMigrationPanel'
import HomeProfiles from './components/HomeProfiles'
import MapView from './components/MapView'
import { LocalStorageTravelRepository } from './lib/LocalStorageTravelRepository'
import { TravelRepository } from './lib/TravelRepository'
import type { ProfileId } from './domain'
import { CUSTOMER_ZERO_ATLAS, CUSTOMER_ZERO_PROFILES, isCustomerZeroProfileId } from './data/customerZero'
import { LocalSeedAtlasRepository, LocalSeedProfileRepository } from './lib/LocalSeedRepositories'
import { supabase } from './lib/supabaseClient'
import {
  createCustomerZeroAtlas,
  getCurrentUserAtlasMembership,
  type AtlasMembership,
} from './lib/customerZeroBootstrap'
import { migrateCustomerZero } from './lib/customerZeroMigration'

const travelRepo: TravelRepository = new LocalStorageTravelRepository()
const atlasRepo = new LocalSeedAtlasRepository(CUSTOMER_ZERO_ATLAS)
const profileRepo = new LocalSeedProfileRepository(CUSTOMER_ZERO_PROFILES)
const atlas = atlasRepo.getAtlas(CUSTOMER_ZERO_ATLAS.id)!
const profiles = profileRepo.getProfiles(atlas.id)

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<AtlasMembership | null>(null)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [isCreatingAtlas, setIsCreatingAtlas] = useState(false)
  const [profile, setProfile] = useState<ProfileId | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession)
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setMembership(null)
      setMembershipLoading(false)
      setMembershipError(null)
      return
    }

    let mounted = true
    setMembershipLoading(true)
    setMembershipError(null)
    getCurrentUserAtlasMembership()
      .then((currentMembership) => {
        if (mounted) setMembership(currentMembership)
      })
      .catch((error: unknown) => {
        if (mounted) setMembershipError(error instanceof Error ? error.message : 'Could not load your Atlas membership.')
      })
      .finally(() => {
        if (mounted) setMembershipLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [session])

  // Initialize profile from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlProfile = params.get('profile')
    if (urlProfile && isCustomerZeroProfileId(urlProfile)) {
      setProfile(urlProfile as ProfileId)
    }
  }, [])

  // Update URL when profile changes
  const handleSelectProfile = (p: ProfileId) => {
    setProfile(p)
    window.history.pushState({}, '', `?profile=${p}`)
  }

  const handleBack = () => {
    setProfile(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out', error)
  }

  async function handleCreateAtlas(details: { atlasName: string; atlasType: 'family' | 'individual'; profileName: string }) {
    setIsCreatingAtlas(true)
    setMembershipError(null)
    try {
      const createdMembership = await createCustomerZeroAtlas({
        ...details,
        mapColour: profiles.find((current) => current.id === 'dad')?.mapColour || '#4f86c6',
      })
      setMembership(createdMembership)
    } catch (error: unknown) {
      setMembershipError(error instanceof Error ? error.message : 'Could not create your Atlas.')
    } finally {
      setIsCreatingAtlas(false)
    }
  }

  if (authLoading) {
    return <main className="auth-loading" role="status">Loading Family Atlas...</main>
  }

  if (!session) {
    return <AuthScreen />
  }

  if (membershipLoading) {
    return <main className="auth-loading" role="status">Checking your Family Atlas...</main>
  }

  if (membershipError && !membership) {
    return (
      <main className="auth-loading" role="alert">
        <p>{membershipError}</p>
      </main>
    )
  }

  if (!membership) {
    return (
      <AtlasSetupScreen
        onCreate={handleCreateAtlas}
        isCreating={isCreatingAtlas}
        error={membershipError}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <div className="app">
      <div className="auth-toolbar">
        <span>Signed in as {session.user.email || 'Family Atlas member'}</span>
        <button className="sign-out-btn" type="button" onClick={handleSignOut}>Sign out</button>
      </div>
      {membership.role === 'admin' && (
        <CustomerZeroMigrationPanel
          atlasId={membership.atlasId}
          onMigrate={() => migrateCustomerZero(membership.atlasId)}
        />
      )}
      {!profile ? (
        <HomeProfiles profiles={profiles} onSelect={handleSelectProfile} />
      ) : (
        <MapView
          profile={profile}
          defaultMapColor={profiles.find((current) => current.id === profile)?.mapColour}
          onBack={handleBack}
          travelRepo={travelRepo}
        />
      )}
    </div>
  )
}
