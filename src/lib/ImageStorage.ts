const GROUP_IMAGE_KEY = 'mytravelmap:v1:group-image'
const PROFILE_IMAGE_PREFIX = 'mytravelmap:v1:profile-image:'

type ImageKind = 'group' | 'profile'

const IMAGE_LIMITS: Record<ImageKind, { maxDimension: number; quality: number }> = {
  group: { maxDimension: 1200, quality: 0.8 },
  profile: { maxDimension: 640, quality: 0.78 },
}

function storageKey(kind: ImageKind, profileId?: string): string {
  return kind === 'group' ? GROUP_IMAGE_KEY : PROFILE_IMAGE_PREFIX + profileId
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image'))
    }
    image.src = objectUrl
  })
}

export async function compressImage(file: File, kind: ImageKind): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')

  const image = await loadImage(file)
  const { maxDimension, quality } = IMAGE_LIMITS[kind]
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image processing is unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', quality)
}

export function getStoredImage(kind: ImageKind, profileId?: string): string | null {
  try {
    return localStorage.getItem(storageKey(kind, profileId))
  } catch (error) {
    console.error('Error reading image', error)
    return null
  }
}

export function storeImage(kind: ImageKind, imageData: string, profileId?: string): boolean {
  try {
    localStorage.setItem(storageKey(kind, profileId), imageData)
    return true
  } catch (error) {
    console.error('Error saving image', error)
    return false
  }
}