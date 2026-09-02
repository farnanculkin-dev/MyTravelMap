import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Profile } from '../domain'
import { compressImage, getStoredImage, storeImage } from '../lib/ImageStorage'

export default function HomeProfiles({ profiles, onSelect, groupImage: cloudGroupImage, profileImages: cloudProfileImages, onUploadImage }: {
  profiles: Profile[]
  onSelect: (profileId: string) => void
  groupImage?: string | null
  profileImages?: Record<string, string | null>
  onUploadImage?: (kind: 'group' | 'profile', profileId: string | undefined, imageData: string) => Promise<void>
}) {
  const [groupImage, setGroupImage] = useState<string | null>(() => cloudGroupImage === undefined ? getStoredImage('group') : cloudGroupImage)
  const [profileImages, setProfileImages] = useState<Record<string, string | null>>(() => cloudProfileImages || Object.fromEntries(profiles.map((profile) => [profile.id, getStoredImage('profile', profile.id)])))
  const [imageError, setImageError] = useState<string | null>(null)
  const groupInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cloudGroupImage !== undefined) setGroupImage(cloudGroupImage)
    if (cloudProfileImages) setProfileImages(cloudProfileImages)
  }, [cloudGroupImage, cloudProfileImages])

  async function handleImageChange(file: File | undefined, kind: 'group' | 'profile', profileId?: string) {
    if (!file) return
    setImageError(null)
    try {
      const compressed = await compressImage(file, kind)
      if (onUploadImage) {
        await onUploadImage(kind, profileId, compressed)
      } else if (!storeImage(kind, compressed, profileId)) {
        setImageError('This image could not be saved. Try a smaller photo.')
        return
      }
      if (kind === 'group') setGroupImage(compressed)
      else if (profileId) setProfileImages((current) => ({ ...current, [profileId]: compressed }))
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'This image could not be uploaded')
    }
  }

  const profileGridStyle = {
    '--profile-count': Math.max(1, profiles.length),
  } as CSSProperties

  return (
    <main className="home">
      <div className="home-title-row">
        <h1>Our Family Travel Map</h1>
      </div>
      <section className="group-photo-section" aria-labelledby="group-photo-title">
        <div className="section-heading">
          <h2 id="group-photo-title">{groupImage ? 'Family Photo' : 'Group Photo'}</h2>
          <label className="photo-action">
            {groupImage ? 'Change Photo' : 'Upload Photo'}
            <input
              ref={groupInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event.target.files?.[0], 'group')}
            />
          </label>
        </div>
        {groupImage ? (
          <img className="group-photo" src={groupImage} alt="Our family" />
        ) : (
          <div className="group-photo-placeholder" aria-hidden="true">Add a family photograph</div>
        )}
      </section>
      <div className="profiles" style={profileGridStyle}>
        {profiles.map((p) => (
          <article key={p.id} className="profile-card" onClick={() => onSelect(p.id)}>
            <button className="profile-btn" type="button">
              {profileImages[p.id] ? (
                <img className="profile-photo" src={profileImages[p.id] || undefined} alt="" />
              ) : (
                <span className="profile-placeholder" aria-hidden="true">{p.name.charAt(0)}</span>
              )}
              <span>{p.name}</span>
            </button>
            <label className="profile-photo-action" onClick={(event) => event.stopPropagation()}>
              {profileImages[p.id] ? 'Change photo' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleImageChange(event.target.files?.[0], 'profile', p.id)}
              />
            </label>
          </article>
        ))}
      </div>
      {imageError && <p className="image-error" role="alert">{imageError}</p>}
      <p className="hint">Tap a profile to view and edit their travel map.</p>
    </main>
  )
}
