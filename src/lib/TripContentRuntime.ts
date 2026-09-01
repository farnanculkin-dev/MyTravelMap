import { supabase } from './supabaseClient'

export type TripPlace = { id:string; tripId:string; name:string; category?:string; countryId?:string; note?:string; latitude?:number; longitude?:number }
export type PersonMapPlace = { id:string; name:string; countryId?:string; latitude?:number; longitude?:number; source:'trip'|'map'; tripId?:string; tripTitle?:string }
export type TripMemory = { id:string; tripId:string; placeId?:string; personId?:string; title:string; body?:string; memoryDate?:string; photoUrl?:string; photoPath?:string }
export type TripPhoto = { id:string; tripId:string; storagePath:string; caption?:string; signedUrl?:string; mediaKind:'photo'|'video' }

async function sign(path?: string | null) {
  if (!path) return undefined
  const { data, error } = await supabase.storage.from('atlas-media').createSignedUrl(path, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

function mapPlace(r:any):TripPlace {
  return {id:r.id,tripId:r.trip_id,name:r.name,...(r.category?{category:r.category}:{}),...(r.country_id?{countryId:r.country_id}:{}),...(r.note?{note:r.note}:{}),...(typeof r.latitude==='number'?{latitude:r.latitude}:{}),...(typeof r.longitude==='number'?{longitude:r.longitude}:{})}
}

export async function loadTripContent(tripId:string):Promise<{places:TripPlace[];memories:TripMemory[];photos:TripPhoto[]}> {
  const [{data:places,error:pe},{data:memories,error:me},{data:media,error:ie}] = await Promise.all([
    supabase.from('trip_places').select('*').eq('trip_id',tripId).order('created_at'),
    supabase.from('trip_memories').select('*').eq('trip_id',tripId).order('memory_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}),
    supabase.from('trip_media').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}),
  ])
  if (pe) throw new Error(`Could not load places: ${pe.message}`)
  if (me) throw new Error(`Could not load memories: ${me.message}`)
  if (ie) throw new Error(`Could not load media: ${ie.message}`)
  return {
    places:(places||[]).map(mapPlace),
    memories:await Promise.all((memories||[]).map(async(r:any)=>({id:r.id,tripId:r.trip_id,...(r.place_id?{placeId:r.place_id}:{}),...(r.person_id?{personId:r.person_id}:{}),title:r.title,...(r.body?{body:r.body}:{}),...(r.memory_date?{memoryDate:r.memory_date}:{}),...(r.photo_path?{photoPath:r.photo_path,photoUrl:await sign(r.photo_path)}:{})}))),
    photos:await Promise.all((media||[]).map(async(r:any)=>({id:r.id,tripId:r.trip_id,storagePath:r.storage_path,mediaKind:r.media_kind==='video'?'video':'photo',...(r.caption?{caption:r.caption}:{}),signedUrl:await sign(r.storage_path)}))),
  }
}

export async function addTripPlace(input:{tripId:string;name:string;category?:string;countryId?:string;note?:string;latitude?:number;longitude?:number}) {
  const {error}=await supabase.from('trip_places').insert({trip_id:input.tripId,name:input.name.trim(),category:input.category?.trim()||null,country_id:input.countryId||null,note:input.note?.trim()||null,latitude:input.latitude??null,longitude:input.longitude??null})
  if(error) throw new Error(`Could not add place: ${error.message}`)
}

export async function updateTripPlaceCoordinates(placeId:string, latitude:number, longitude:number) {
  const {error}=await supabase.from('trip_places').update({latitude,longitude}).eq('id',placeId)
  if(error) throw new Error(`Could not save place on map: ${error.message}`)
}

export async function geocodePlace(name:string, countryName?:string):Promise<{latitude:number;longitude:number;label:string}|null> {
  const query=[name.trim(),countryName?.trim()].filter(Boolean).join(', ')
  if(!query) return null
  const response=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,{headers:{Accept:'application/json'}})
  if(!response.ok) throw new Error('Map lookup is temporarily unavailable.')
  const rows=await response.json() as Array<{lat:string;lon:string;display_name:string}>
  if(!rows[0]) return null
  return {latitude:Number(rows[0].lat),longitude:Number(rows[0].lon),label:rows[0].display_name}
}

export async function addProfileMapPlace(input:{profileId:string;countryId:string;name:string;latitude:number;longitude:number}) {
  const {error}=await supabase.from('profile_map_places').insert({
    profile_id:input.profileId,
    country_id:input.countryId,
    name:input.name.trim(),
    latitude:input.latitude,
    longitude:input.longitude,
  })
  if(error) throw new Error(error.code==='23505' ? `${input.name.trim()} is already on this map.` : `Could not add place to map: ${error.message}`)
}

export async function deleteProfileMapPlace(placeId:string) {
  const {error}=await supabase.from('profile_map_places').delete().eq('id',placeId)
  if(error) throw new Error(`Could not remove place from map: ${error.message}`)
}

export async function loadPersonMapPlaces(personId:string, profileId?:string):Promise<PersonMapPlace[]> {
  const [{data:participantRows,error:participantError},{data:quickRows,error:quickError}] = await Promise.all([
    supabase.from('trip_participants').select('trip_id').eq('person_id',personId),
    profileId ? supabase.from('profile_map_places').select('id,name,country_id,latitude,longitude').eq('profile_id',profileId).order('created_at') : Promise.resolve({data:[],error:null} as any),
  ])
  if(participantError) throw new Error(`Could not load place markers: ${participantError.message}`)
  if(quickError) throw new Error(`Could not load map places: ${quickError.message}`)
  const quickPlaces:PersonMapPlace[]=(quickRows||[]).map((r:any)=>({id:r.id,name:r.name,countryId:r.country_id,latitude:r.latitude,longitude:r.longitude,source:'map'}))
  const tripIds=[...new Set((participantRows||[]).map((r:any)=>r.trip_id))]
  if(tripIds.length===0) return quickPlaces
  const [{data:places,error:placeError},{data:trips,error:tripError}]=await Promise.all([
    supabase.from('trip_places').select('id,trip_id,name,category,country_id,note,latitude,longitude').in('trip_id',tripIds).not('latitude','is',null).not('longitude','is',null),
    supabase.from('trips').select('id,title').in('id',tripIds),
  ])
  if(placeError) throw new Error(`Could not load place markers: ${placeError.message}`)
  if(tripError) throw new Error(`Could not load trip names: ${tripError.message}`)
  const tripNames=new Map((trips||[]).map((r:any)=>[r.id,r.title]))
  const tripPlaces:PersonMapPlace[]=(places||[]).map((r:any)=>({id:r.id,name:r.name,countryId:r.country_id,latitude:r.latitude,longitude:r.longitude,source:'trip',tripId:r.trip_id,tripTitle:tripNames.get(r.trip_id)||'Trip'}))
  const seen=new Set<string>()
  return [...tripPlaces,...quickPlaces].filter((place)=>{
    const key=`${place.countryId||''}|${place.name.trim().toLocaleLowerCase()}`
    if(seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function addTripMemory(input:{tripId:string;title:string;body?:string;placeId?:string;personId?:string;memoryDate?:string}) {
  const {data,error}=await supabase.from('trip_memories').insert({trip_id:input.tripId,title:input.title.trim(),body:input.body?.trim()||null,place_id:input.placeId||null,person_id:input.personId||null,memory_date:input.memoryDate||null}).select('id').single()
  if(error||!data) throw new Error(`Could not add memory: ${error?.message||'Unknown error'}`)
  return data.id as string
}

function dataUrlToBlob(dataUrl:string){
  const [header,encoded]=dataUrl.split(',',2); const mime=header.match(/^data:([^;]+);base64$/)?.[1]
  if(!mime||!encoded) throw new Error('Invalid media data')
  const binary=atob(encoded); const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i)
  return {blob:new Blob([bytes],{type:mime}),mime,ext:(mime.split('/')[1]||'bin').replace('jpeg','jpg').replace('quicktime','mov')}
}

async function uploadTripMedia(input:{atlasId:string;tripId:string;dataUrl:string;caption?:string;mediaKind:'photo'|'video'}) {
  const {blob,mime,ext}=dataUrlToBlob(input.dataUrl)
  const path=`${input.atlasId}/trips/${input.tripId}/${input.mediaKind}s/${crypto.randomUUID()}.${ext}`
  const {error:ue}=await supabase.storage.from('atlas-media').upload(path,blob,{contentType:mime,upsert:false})
  if(ue) throw new Error(`Could not upload trip ${input.mediaKind}: ${ue.message}`)
  const {error}=await supabase.from('trip_media').insert({trip_id:input.tripId,storage_path:path,caption:input.caption?.trim()||null,media_kind:input.mediaKind})
  if(error) throw new Error(`Could not save trip ${input.mediaKind}: ${error.message}`)
}

export async function uploadTripPhoto(input:{atlasId:string;tripId:string;dataUrl:string;caption?:string}) {
  return uploadTripMedia({...input,mediaKind:'photo'})
}

export async function uploadTripVideo(input:{atlasId:string;tripId:string;dataUrl:string;caption?:string}) {
  return uploadTripMedia({...input,mediaKind:'video'})
}

export async function uploadTripCoverPhoto(input:{atlasId:string;tripId:string;dataUrl:string}) {
  const {blob,mime,ext}=dataUrlToBlob(input.dataUrl)
  const path=`${input.atlasId}/trips/${input.tripId}/cover.${ext}`
  const {error:uploadError}=await supabase.storage.from('atlas-media').upload(path,blob,{contentType:mime,upsert:true})
  if(uploadError) throw new Error(`Could not upload trip cover photo: ${uploadError.message}`)
  const {error:updateError}=await supabase.from('trips').update({cover_photo_path:path}).eq('id',input.tripId)
  if(updateError) throw new Error(`Could not save trip cover photo: ${updateError.message}`)
}

export async function uploadMemoryPhoto(input:{atlasId:string;tripId:string;memoryId:string;dataUrl:string}) {
  const {blob,mime,ext}=dataUrlToBlob(input.dataUrl); const path=`${input.atlasId}/trips/${input.tripId}/memories/${input.memoryId}.${ext}`
  const {error:ue}=await supabase.storage.from('atlas-media').upload(path,blob,{contentType:mime,upsert:true})
  if(ue) throw new Error(`Could not upload memory photo: ${ue.message}`)
  const {error}=await supabase.from('trip_memories').update({photo_path:path}).eq('id',input.memoryId)
  if(error) throw new Error(`Could not save memory photo: ${error.message}`)
}

export async function deleteTripPhoto(photo:TripPhoto){
  const {error:storageError}=await supabase.storage.from('atlas-media').remove([photo.storagePath]); if(storageError)throw new Error(`Could not remove media file: ${storageError.message}`)
  const {error}=await supabase.from('trip_media').delete().eq('id',photo.id); if(error)throw new Error(`Could not remove trip media: ${error.message}`)
}
export async function deleteTripPlace(placeId:string){const {error}=await supabase.from('trip_places').delete().eq('id',placeId);if(error)throw new Error(`Could not remove place: ${error.message}`)}
export async function deleteTripMemory(memory:TripMemory){if(memory.photoPath){const {error:storageError}=await supabase.storage.from('atlas-media').remove([memory.photoPath]);if(storageError)throw new Error(`Could not remove memory photo: ${storageError.message}`)}const {error}=await supabase.from('trip_memories').delete().eq('id',memory.id);if(error)throw new Error(`Could not remove memory: ${error.message}`)}
export async function deleteMemoryPhoto(memory:TripMemory){if(memory.photoPath){const {error:storageError}=await supabase.storage.from('atlas-media').remove([memory.photoPath]);if(storageError)throw new Error(`Could not remove memory photo file: ${storageError.message}`)}const {error}=await supabase.from('trip_memories').update({photo_path:null}).eq('id',memory.id);if(error)throw new Error(`Could not remove memory photo: ${error.message}`)}
export async function deleteTripCoverPhoto(tripId:string){const {data,error:readError}=await supabase.from('trips').select('cover_photo_path').eq('id',tripId).single();if(readError)throw new Error(`Could not read cover photo: ${readError.message}`);if(data?.cover_photo_path){const {error:storageError}=await supabase.storage.from('atlas-media').remove([data.cover_photo_path]);if(storageError)throw new Error(`Could not remove cover photo file: ${storageError.message}`)}const {error}=await supabase.from('trips').update({cover_photo_path:null}).eq('id',tripId);if(error)throw new Error(`Could not remove cover photo: ${error.message}`)}
