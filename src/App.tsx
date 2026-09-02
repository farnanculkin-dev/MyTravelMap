import React, { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import AtlasSetupScreen from './components/AtlasSetupScreen'
import AppHeader from './components/AppHeader'
import MemberInvitePanel from './components/MemberInvitePanel'
import HomeProfiles from './components/HomeProfiles'
import MapHub from './components/MapHub'
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

type AppSection = 'home' | 'trips' | 'settings'

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
  const [section, setSection] = useState<AppSection>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('trip') || params.has('newTripPerson') || params.has('newTrip') || params.has('timeline') ? 'trips' : 'home'
  })
  const [newTripPersonId,setNewTripPersonId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('newTripPerson'))
  const activeProfiles = cloudData?.profiles || fallbackProfiles

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) { setSession(currentSession); setAuthLoading(false) }
    }).catch((error: unknown) => {
      if (mounted) { console.error('Could not restore Supabase session', error); setSession(null); setAuthLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false) })
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
    if (!session) { setMembership(null); setMembershipLoading(false); setMembershipError(null); setSection('home'); return }
    let mounted = true
    setMembershipLoading(true); setMembershipError(null)
    consumePendingInvitation().then(() => getCurrentUserAtlasMembership()).then((currentMembership) => { if (mounted) setMembership(currentMembership) }).catch((error: unknown) => { if (mounted) setMembershipError(error instanceof Error ? error.message : 'Could not load your Atlas membership.') }).finally(() => { if (mounted) setMembershipLoading(false) })
    return () => { mounted = false }
  }, [session])

  useEffect(() => {
    if (!membership) { setCloudData(null); setCloudLoading(false); return }
    let mounted = true
    setCloudLoading(true); setCloudError(null)
    loadSupabaseAtlas(membership.atlasId).then((data) => { if (mounted) setCloudData(data) }).catch((error: unknown) => { if (mounted) setCloudError(error instanceof Error ? error.message : 'Cloud Atlas data could not be loaded.') }).finally(() => { if (mounted) setCloudLoading(false) })
    return () => { mounted = false }
  }, [membership])

  useEffect(() => { const params = new URLSearchParams(window.location.search); const urlProfile = params.get('profile'); if (urlProfile) setProfile(urlProfile) }, [])
  useEffect(() => { if (profile && !activeProfiles.some((current) => current.id === profile)) { setProfile(null); window.history.replaceState({}, '', window.location.pathname) } }, [activeProfiles, profile])

  const handleSelectProfile = (profileId: string) => { setSection('home'); setProfile(profileId); window.history.pushState({}, '', `?profile=${profileId}`) }
  const handleHome = () => { setProfile(null); setSection('home'); setNewTripPersonId(null); window.history.pushState({}, '', window.location.pathname) }
  const handleMyMap = () => { if (!membership) return; setSection('home'); setProfile(membership.profileId); setNewTripPersonId(null); window.history.pushState({}, '', `?profile=${membership.profileId}`) }
  const handleOpenTrips = () => { setProfile(null); setNewTripPersonId(null); setSection('trips'); window.history.replaceState({}, '', window.location.pathname) }
  const handleOpenSettings = () => { setProfile(null); setNewTripPersonId(null); setSection('settings'); window.history.replaceState({}, '', window.location.pathname) }
  const handleOpenTrip = (tripId: string) => { setProfile(null); setNewTripPersonId(null); window.history.replaceState({}, '', `${window.location.pathname}?trip=${encodeURIComponent(tripId)}`); setSection('trips') }
  const handleOpenPlace = (tripId:string, placeId:string) => { setProfile(null); setNewTripPersonId(null); window.history.replaceState({}, '', `${window.location.pathname}?trip=${encodeURIComponent(tripId)}&place=${encodeURIComponent(placeId)}`); setSection('trips') }
  const handleAddTripForPerson=(personId:string)=>{setProfile(null);setNewTripPersonId(personId);setSection('trips');window.history.replaceState({},'',`${window.location.pathname}?newTripPerson=${encodeURIComponent(personId)}`)}
  const handleSignOut = async () => { setProfile(null); setSection('home'); setNewTripPersonId(null); window.history.replaceState({}, '', window.location.pathname); const { error } = await supabase.auth.signOut(); if (error) console.error('Error signing out', error) }
  const handleCreateAtlas = async (details: { atlasName: string; atlasType: 'family' | 'individual'; profileName: string }) => { setIsCreatingAtlas(true); setMembershipError(null); try { setMembership(await createCustomerZeroAtlas({ ...details, mapColour: '#4f86c6' })) } catch (error: unknown) { setMembershipError(error instanceof Error ? error.message : 'Could not create your Atlas.') } finally { setIsCreatingAtlas(false) } }

  if (authLoading) return <main className="auth-loading" role="status">Loading Family Atlas...</main>
  if (!session) return <AuthScreen />
  if (membershipLoading || cloudLoading) return <main className="auth-loading" role="status">Checking your Family Atlas...</main>
  if (membershipError && !membership) return <main className="auth-loading" role="alert"><p>{membershipError}</p></main>
  if (!membership) return <AtlasSetupScreen onCreate={handleCreateAtlas} isCreating={isCreatingAtlas} error={membershipError} onSignOut={handleSignOut} />

  const activeProfile = activeProfiles.find((current) => current.id === profile)
  const activeNav = section === 'trips' ? 'trips' : section === 'settings' ? 'settings' : profile === membership.profileId ? 'map' : 'home'
  const uploadImage = async (kind: 'group' | 'profile', profileId: string | undefined, imageData: string) => {
    if (kind === 'group' && membership.role !== 'admin') throw new Error('Only an Atlas administrator can change the group photo.')
    const signedUrl = await uploadCloudMedia({ atlasId: membership.atlasId, profileId, kind, dataUrl: imageData })
    setCloudData((current) => current ? { ...current, groupImage: kind === 'group' ? signedUrl : current.groupImage, profileImages: kind === 'profile' && profileId ? { ...current.profileImages, [profileId]: signedUrl } : current.profileImages } : current)
  }

  return <div className="app">
    <AppHeader email={session.user.email} active={activeNav} onHome={handleHome} onMap={handleMyMap} onTrips={handleOpenTrips} onSettings={handleOpenSettings} onSignOut={handleSignOut} />
    {cloudError && <p className="cloud-error" role="alert">Cloud data could not be loaded. Showing local fallback data. {cloudError}</p>}
    {section === 'settings' ? <main className="settings-screen"><div className="settings-title"><p className="auth-eyebrow">Family Atlas</p><h1>Settings</h1><p>Manage family access and account setup without cluttering your travel pages.</p></div>{membership.role === 'admin' ? <MemberInvitePanel atlasId={membership.atlasId} profiles={activeProfiles} /> : <section className="settings-card"><h2>Family access</h2><p>Only an Atlas administrator can invite another member.</p></section>}</main> : section === 'trips' ? <TripsScreen atlasId={membership.atlasId} profiles={activeProfiles} onBack={handleHome} initialParticipantId={newTripPersonId||undefined} /> : !profile ? <HomeProfiles profiles={activeProfiles} onSelect={handleSelectProfile} groupImage={cloudData?.groupImage} profileImages={cloudData?.profileImages} onUploadImage={cloudData ? uploadImage : undefined} /> : <>
      <MapHub profile={profile} personId={activeProfile?.personId} profileName={activeProfile?.name} defaultMapColor={activeProfile?.mapColour} onBack={handleHome} onOpenPlace={handleOpenPlace} travelRepo={travelRepo} cloudVisited={cloudData?.visitedByProfile[profile]} cloudMapColor={activeProfile?.mapColour} onSaveVisited={cloudData ? (visited) => saveCloudVisited(profile, visited) : undefined} onSaveMapColor={cloudData ? async (color) => { await saveCloudMapColour(profile, color); setCloudData((current) => current ? { ...current, profiles: current.profiles.map((item) => item.id === profile ? { ...item, mapColour: color } : item) } : current) } : undefined} />
      <ProfileTripsPanel atlasId={membership.atlasId} personId={activeProfile?.personId} personName={activeProfile?.name || 'Traveller'} onOpenTrip={handleOpenTrip} onAddTrip={handleAddTripForPerson} />
    </>}
  </div>
}
