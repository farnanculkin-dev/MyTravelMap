import React, { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import AtlasSetupScreen from './components/AtlasSetupScreen'
import MemberInvitePanel from './components/MemberInvitePanel'
import HomeProfiles from './components/HomeProfiles'
import MapView from './components/MapView'
import ProfileTripsPanel from './components/ProfileTripsPanel'
import TripsScreen from './components/TripsScreen'
import { LocalStorageTravelRepository } from './lib/LocalStorageTravelRepository'
import { TravelRepository } from './lib/TravelRepository'
import { CUSTOMER_ZERO_ATLAS, CUSTOMER_ZERO_PROFILES } from './data/customerZero'
import { LocalSeedAtlasRepository, LocalSeedProfileRepository } from './lib/LocalSeedRepositories'
import { supabase } from './lib/supabaseClient'
import { createCustomerZeroAtlas, getCurrentUserAtlasMembership, type AtlasMembership } from './lib/customerZeroBootstrap'
import { consumePendingInvitation } from './lib/memberInvitation'
import { loadSupabaseAtlas, saveCloudMapColour, saveCloudVisited, uploadCloudMedia, type CloudAtlasData } from './lib/SupabaseAtlasRuntime'

const travelRepo: TravelRepository = new LocalStorageTravelRepository()
const atlasRepo = new LocalSeedAtlasRepository(CUSTOMER_ZERO_ATLAS)
const profileRepo = new LocalSeedProfileRepository(CUSTOMER_ZERO_PROFILES)
const atlas = atlasRepo.getAtlas(CUSTOMER_ZERO_ATLAS.id)!
const fallbackProfiles = profileRepo.getProfiles(atlas.id)

type AppSection = 'home' | 'trips'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<AtlasMembership | null>(null)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [isCreatingAtlas, setIsCreatingAtlas] = useState(false)
  const [cloudData, setCloudData] = useState<CloudAtlasData | null>(null)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [profile, setProfile] = useState<string | null>(null)
  const [section, setSection] = useState<AppSection>(() => new URLSearchParams(window.location.search).has('trip') ? 'trips' : 'home')
  const activeProfiles = cloudData?.profiles || fallbackProfiles

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) { setSession(currentSession); setAuthLoading(false) }
    }).catch((error: unknown) => {
      if (mounted) {
        console.error('Could not restore Supabase session', error)
        setSession(null)
        setAuthLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=')
    const params = new URLSearchParams(window.location.search)
    const hasAuthCode = params.has('code')
    if (hasAuthHash || hasAuthCode) {
      params.delete('code')
      const cleanSearch = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setMembership(null)
      setMembershipLoading(false)
      setMembershipError(null)
      setSection('home')
      return
    }
    let mounted = true
    setMembershipLoading(true)
    setMembershipError(null)
    consumePendingInvitation()
      .then(() => getCurrentUserAtlasMembership())
      .then((currentMembership) => { if (mounted) setMembership(currentMembership) })
      .catch((error: unknown) => { if (mounted) setMembershipError(error instanceof Error ? error.message : 'Could not load your Atlas membership.') })
      .finally(() => { if (mounted) setMembershipLoading(false) })
    return () => { mounted = false }
  }, [session])

  useEffect(() => {
    if (!membership) { setCloudData(null); setCloudLoading(false); return }
    let mounted = true
    setCloudLoading(true)
    setCloudError(null)
    loadSupabaseAtlas(membership.atlasId)
      .then((data) => { if (mounted) setCloudData(data) })
      .catch((error: unknown) => { if (mounted) setCloudError(error instanceof Error ? error.message : 'Cloud Atlas data could not be loaded.') })
      .finally(() => { if (mounted) setCloudLoading(false) })
    return () => { mounted = false }
  }, [membership])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlProfile = params.get('profile')
    if (urlProfile) setProfile(urlProfile)
  }, [])

  useEffect(() => {
    if (profile && !activeProfiles.some((current) => current.id === profile)) {
      setProfile(null)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [activeProfiles, profile])

  const handleSelectProfile = (profileId: string) => {
    setSection('home')
    setProfile(profileId)
    window.history.pushState({}, '', `?profile=${profileId}`)
  }
  const handleBack = () => {
    setProfile(null)
    setSection('home')
    window.history.pushState({}, '', window.location.pathname)
  }
  const handleOpenTrips = () => {
    setProfile(null)
    setSection('trips')
    window.history.replaceState({}, '', window.location.pathname)
  }
  const handleOpenTrip = (tripId: string) => {
    setProfile(null)
    window.history.replaceState({}, '', `${window.location.pathname}?trip=${encodeURIComponent(tripId)}`)
    setSection('trips')
  }
  const handleOpenPlace = (tripId:string, placeId:string) => {
    setProfile(null)
    window.history.replaceState({}, '', `${window.location.pathname}?trip=${encodeURIComponent(tripId)}&place=${encodeURIComponent(placeId)}`)
    setSection('trips')
  }
  const handleSignOut = async () => {
    setProfile(null)
    setSection('home')
    window.history.replaceState({}, '', window.location.pathname)
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out', error)
  }
  const handleCreateAtlas = async (details: { atlasName: string; atlasType: 'family' | 'individual'; profileName: string }) => {
    setIsCreatingAtlas(true)
    setMembershipError(null)
    try { setMembership(await createCustomerZeroAtlas({ ...details, mapColour: '#4f86c6' })) }
    catch (error: unknown) { setMembershipError(error instanceof Error ? error.message : 'Could not create your Atlas.') }
    finally { setIsCreatingAtlas(false) }
  }

  if (authLoading) return <main className="auth-loading" role="status">Loading Family Atlas...</main>
  if (!session) return <AuthScreen />
  if (membershipLoading || cloudLoading) return <main className="auth-loading" role="status">Checking your Family Atlas...</main>
  if (membershipError && !membership) return <main className="auth-loading" role="alert"><p>{membershipError}</p></main>
  if (!membership) return <AtlasSetupScreen onCreate={handleCreateAtlas} isCreating={isCreatingAtlas} error={membershipError} onSignOut={handleSignOut} />

  const activeProfile = activeProfiles.find((current) => current.id === profile)
  const uploadImage = async (kind: 'group' | 'profile', profileId: string | undefined, imageData: string) => {
    if (kind === 'group' && membership.role !== 'admin') throw new Error('Only an Atlas administrator can change the group photo.')
    const signedUrl = await uploadCloudMedia({ atlasId: membership.atlasId, profileId, kind, dataUrl: imageData })
    setCloudData((current) => current ? {
      ...current,
      groupImage: kind === 'group' ? signedUrl : current.groupImage,
      profileImages: kind === 'profile' && profileId ? { ...current.profileImages, [profileId]: signedUrl } : current.profileImages,
    } : current)
  }

  return (
    <div className="app">
      <div className="auth-toolbar">
        <span>Signed in as {session.user.email || 'Family Atlas member'}</span>
        <button className="sign-out-btn" type="button" onClick={handleSignOut}>Sign out</button>
      </div>
      {section === 'home' && !profile && membership.role === 'admin' && <MemberInvitePanel atlasId={membership.atlasId} />}
      {cloudError && <p className="cloud-error" role="alert">Cloud data could not be loaded. Showing local fallback data. {cloudError}</p>}
      {section === 'trips' ? (
        <TripsScreen atlasId={membership.atlasId} profiles={activeProfiles} onBack={handleBack} />
      ) : !profile ? (
        <HomeProfiles profiles={activeProfiles} onSelect={handleSelectProfile} onTrips={handleOpenTrips} groupImage={cloudData?.groupImage} profileImages={cloudData?.profileImages} onUploadImage={cloudData ? uploadImage : undefined} />
      ) : (
        <>
          <MapView
            profile={profile}
            personId={activeProfile?.personId}
            profileName={activeProfile?.name}
            defaultMapColor={activeProfile?.mapColour}
            onBack={handleBack}
            onOpenPlace={handleOpenPlace}
            travelRepo={travelRepo}
            cloudVisited={cloudData?.visitedByProfile[profile]}
            cloudMapColor={activeProfile?.mapColour}
            onSaveVisited={cloudData ? (visited) => saveCloudVisited(profile, visited) : undefined}
            onSaveMapColor={cloudData ? async (color) => {
              await saveCloudMapColour(profile, color)
              setCloudData((current) => current ? { ...current, profiles: current.profiles.map((item) => item.id === profile ? { ...item, mapColour: color } : item) } : current)
            } : undefined}
          />
          <ProfileTripsPanel atlasId={membership.atlasId} personId={activeProfile?.personId} personName={activeProfile?.name || 'Traveller'} onOpenTrip={handleOpenTrip} />
        </>
      )}
    </div>
  )
}
