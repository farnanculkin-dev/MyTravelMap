import React, { useEffect, useMemo, useState } from 'react'
import type { Profile, Trip } from '../domain'
import countries from '../data/countries.json'
import { createGuestPerson, loadGuestPeople, type GuestPerson } from '../lib/PersonRuntime'
import { createTrip, loadTrips, updateTrip } from '../lib/TripRuntime'
import { uploadTripCoverPhoto } from '../lib/TripContentRuntime'
import TripContentPanel from './TripContentPanel'

type Country = { id: string; name: string; topoName?: string }
const countryList = countries as Country[]
const countryNames = new Map(countryList.map((country) => [country.id, country.name]))

function tripDateLabel(trip: Trip): string {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`
  if (trip.startDate) return trip.startDate
  if (trip.endDate) return `Until ${trip.endDate}`
  return 'Date not added yet'
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function TripsScreen({ atlasId, profiles, onBack }: {
  atlasId: string
  profiles: Profile[]
  onBack: () => void
}) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [guestPeople, setGuestPeople] = useState<GuestPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('trip'))
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'atlas' | 'private'>('atlas')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [countryIds, setCountryIds] = useState<string[]>([])
  const [countryToAdd, setCountryToAdd] = useState('')
  const [guestName, setGuestName] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const personProfiles = useMemo(() => profiles.filter((profile) => profile.personId), [profiles])
  const atlasPersonIds = useMemo(() => personProfiles.map((profile) => profile.personId!), [personProfiles])
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) || null

  async function refreshTrips() {
    setLoading(true)
    setError(null)
    try { setTrips(await loadTrips(atlasId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Trips could not be loaded.') }
    finally { setLoading(false) }
  }

  async function refreshGuestPeople() {
    try { setGuestPeople(await loadGuestPeople(atlasPersonIds)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'People could not be loaded.') }
  }

  useEffect(() => { void refreshTrips() }, [atlasId])
  useEffect(() => { void refreshGuestPeople() }, [atlasId, atlasPersonIds.join('|')])

  function toggleParticipant(personId: string) {
    setParticipantIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId])
  }

  async function handleAddGuest() {
    if (!guestName.trim() || addingGuest) return
    setAddingGuest(true)
    setError(null)
    try {
      const person = await createGuestPerson(guestName)
      setGuestPeople((current) => [...current, person].sort((a, b) => a.displayName.localeCompare(b.displayName)))
      setParticipantIds((current) => current.includes(person.id) ? current : [...current, person.id])
      setGuestName('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Person could not be added.')
    } finally {
      setAddingGuest(false)
    }
  }

  function addCountry() {
    if (!countryToAdd || countryIds.includes(countryToAdd)) return
    setCountryIds((current) => [...current, countryToAdd])
    setCountryToAdd('')
  }

  function resetForm() {
    setTitle('')
    setStartDate('')
    setEndDate('')
    setDescription('')
    setVisibility('atlas')
    setParticipantIds([])
    setCountryIds([])
    setCountryToAdd('')
    setGuestName('')
    setCoverFile(null)
  }

  function beginEdit(trip: Trip) {
    setTitle(trip.title)
    setStartDate(trip.startDate || '')
    setEndDate(trip.endDate || '')
    setDescription(trip.description || '')
    setVisibility(trip.visibility)
    setParticipantIds(trip.participantIds)
    setCountryIds(trip.countryIds)
    setCountryToAdd('')
    setGuestName('')
    setCoverFile(null)
    setEditing(true)
  }

  function openTrip(id: string) {
    setSelectedTripId(id)
    setEditing(false)
    window.history.replaceState({}, '', `${window.location.pathname}?trip=${id}`)
  }

  async function uploadCoverIfSelected(tripId: string) {
    if (!coverFile) return
    await uploadTripCoverPhoto({ atlasId, tripId, dataUrl: await readFile(coverFile) })
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const id = await createTrip({ atlasId, title, startDate: startDate || undefined, endDate: endDate || undefined, description: description || undefined, visibility, participantPersonIds: participantIds, countryIds })
      await uploadCoverIfSelected(id)
      resetForm()
      setShowCreate(false)
      await refreshTrips()
      openTrip(id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Trip could not be created.')
    } finally { setSaving(false) }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedTrip) return
    setSaving(true)
    setError(null)
    try {
      await updateTrip({ tripId: selectedTrip.id, title, startDate: startDate || undefined, endDate: endDate || undefined, description: description || undefined, visibility, participantPersonIds: participantIds, countryIds })
      await uploadCoverIfSelected(selectedTrip.id)
      await refreshTrips()
      setEditing(false)
      resetForm()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Trip could not be updated.')
    } finally { setSaving(false) }
  }

  function renderTripForm(mode: 'create' | 'edit') {
    return (
      <form className="trip-form" onSubmit={mode === 'create' ? handleCreate : handleUpdate}>
        <h2>{mode === 'create' ? 'Add a trip' : 'Edit trip'}</h2>
        <label>Trip name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. French Riviera 2026" required /></label>
        <div className="trip-form-row"><label>Start date <span>(optional)</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>End date <span>(optional)</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></div>
        <fieldset className="trip-fieldset"><legend>Who went?</legend><p className="trip-form-help">You are included automatically. Add people from your Family Atlas or anyone else who travelled.</p><div className="participant-picker">{personProfiles.map((profile) => <label key={profile.id}><input type="checkbox" checked={participantIds.includes(profile.personId!)} onChange={() => toggleParticipant(profile.personId!)} />{profile.name}</label>)}{guestPeople.map((person) => <label key={person.id}><input type="checkbox" checked={participantIds.includes(person.id)} onChange={() => toggleParticipant(person.id)} />{person.displayName}</label>)}</div><div className="country-adder" aria-label="Add someone outside your Family Atlas"><input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Add someone else, e.g. Grandad" aria-label="Name of another person" /><button className="secondary-btn" type="button" onClick={handleAddGuest} disabled={!guestName.trim() || addingGuest}>{addingGuest ? 'Adding…' : '+ Add person'}</button></div><p className="trip-form-help">They do not need a Family Atlas account. Once added, you can reuse them on future trips.</p></fieldset>
        <fieldset className="trip-fieldset"><legend>Countries</legend><div className="country-adder"><select value={countryToAdd} onChange={(event) => setCountryToAdd(event.target.value)}><option value="">Choose a country</option>{countryList.filter((country) => !countryIds.includes(country.id)).map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select><button className="secondary-btn" type="button" onClick={addCountry} disabled={!countryToAdd}>Add</button></div>{countryIds.length > 0 && <div className="trip-tags">{countryIds.map((id) => <button type="button" key={id} onClick={() => setCountryIds((current) => current.filter((item) => item !== id))}>{countryNames.get(id) || id} ×</button>)}</div>}</fieldset>
        <label>Description <span>(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="A few words about the trip..." /></label>
        <label>Cover photo <span>(optional)</span><input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} /></label>
        <label>Who can see it?<select value={visibility} onChange={(event) => setVisibility(event.target.value as 'atlas' | 'private')}><option value="atlas">My Family Atlas</option><option value="private">Only me</option></select></label>
        <div className="trip-form-actions">
          {mode === 'edit' && <button className="secondary-btn" type="button" onClick={() => { setEditing(false); resetForm() }}>Cancel</button>}
          <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : mode === 'create' ? 'Save trip' : 'Save changes'}</button>
        </div>
      </form>
    )
  }

  if (selectedTrip) {
    return (
      <main className="trips-screen">
        <div className="trips-header">
          <button className="back-btn" type="button" onClick={() => { setSelectedTripId(null); setEditing(false); resetForm(); window.history.replaceState({}, '', window.location.pathname) }}>← Trips</button>
          <div className="trip-header-actions"><span className="trip-visibility">{selectedTrip.visibility === 'private' ? 'Private' : 'Family Atlas'}</span>{!editing && <button className="secondary-btn" type="button" onClick={() => beginEdit(selectedTrip)}>Edit trip</button>}</div>
        </div>
        {error && <p className="auth-error trip-error" role="alert">{error}</p>}
        {editing ? renderTripForm('edit') : (
          <article className="trip-detail">
            {selectedTrip.coverPhotoUrl && <img className="trip-cover-photo" src={selectedTrip.coverPhotoUrl} alt={`${selectedTrip.title} cover`} />}
            <p className="auth-eyebrow">Trip</p>
            <h1>{selectedTrip.title}</h1>
            <p className="trip-dates">{tripDateLabel(selectedTrip)}</p>
            {selectedTrip.countryIds.length > 0 && <div className="trip-tags" aria-label="Countries">{selectedTrip.countryIds.map((id) => <span key={id}>{countryNames.get(id) || id}</span>)}</div>}
            <section className="trip-detail-section"><h2>Who went?</h2><p>{selectedTrip.participantNames.join(', ') || 'Participants can be added later.'}</p></section>
            {selectedTrip.description && <section className="trip-detail-section"><h2>About this trip</h2><p>{selectedTrip.description}</p></section>}
            <TripContentPanel atlasId={atlasId} trip={selectedTrip} profiles={profiles} />
          </article>
        )}
      </main>
    )
  }

  return (
    <main className="trips-screen">
      <div className="trips-header">
        <button className="back-btn" type="button" onClick={onBack}>← Family Atlas</button>
        <button className="primary-btn trips-add-btn" type="button" onClick={() => { if (!showCreate) resetForm(); setShowCreate((value) => !value) }}>{showCreate ? 'Cancel' : '+ Add trip'}</button>
      </div>
      <div className="trips-title"><p className="auth-eyebrow">Family Atlas</p><h1>Trips</h1><p>Keep the journeys that make up your travel life — family holidays, solo trips and everything in between.</p></div>
      {error && <p className="auth-error trip-error" role="alert">{error}</p>}
      {showCreate && renderTripForm('create')}
      {loading ? <p className="trips-empty">Loading trips…</p> : trips.length === 0 ? <section className="trips-empty-card"><h2>Your travel story starts here</h2><p>Add a recent holiday or a trip from years ago. You can add more detail later.</p>{!showCreate && <button className="primary-btn" type="button" onClick={() => { resetForm(); setShowCreate(true) }}>+ Add your first trip</button>}</section> : <section className="trip-grid" aria-label="Trips">{trips.map((trip) => <button className="trip-card" key={trip.id} type="button" onClick={() => openTrip(trip.id)}>{trip.coverPhotoUrl && <img className="trip-card-cover" src={trip.coverPhotoUrl} alt="" />}<span className="trip-card-label">{trip.visibility === 'private' ? 'Private trip' : 'Family trip'}</span><strong>{trip.title}</strong><span>{tripDateLabel(trip)}</span>{trip.countryIds.length > 0 && <span>{trip.countryIds.map((id) => countryNames.get(id) || id).join(' · ')}</span>}<span className="trip-card-people">{trip.participantNames.join(', ')}</span></button>)}</section>}
    </main>
  )
}
