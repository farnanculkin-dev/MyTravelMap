import { supabase } from './supabaseClient'

export type TripPlace = { id:string; tripId:string; name:string; category?:string; countryId?:string; note?:string }
export type TripMemory = { id:string; tripId:string; placeId?:string; personId?:string; title:string; body?:string; memoryDate?:string; photoUrl?:string }
export type TripPhoto = { id:string; tripId:string; storagePath:string; caption?:string; signedUrl?:string }

async function sign(path?: string | null) {
  if (!path) return undefined
  const { data, error } = await supabase.storage.from('atlas-media').createSignedUrl(path, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function loadTripContent(tripId:string):Promise<{places:TripPlace[];memories:TripMemory[];photos:TripPhoto[]}> {
  const [{data:places,error:pe},{data:memories,error:me},{data:media,error:ie}] = await Promise.all([
    supabase.from('trip_places').select('*').eq('trip_id',tripId).order('created_at'),
    supabase.from('trip_memories').select('*').eq('trip_id',tripId).order('memory_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}),
    supabase.from('trip_media').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}),
  ])
  if (pe) throw new Error(`Could not load places: ${pe.message}`)
  if (me) throw new Error(`Could not load memories: ${me.message}`)
  if (ie) throw new Error(`Could not load photos: ${ie.message}`)
  return {
    places:(places||[]).map((r:any)=>({id:r.id,tripId:r.trip_id,name:r.name,...(r.category?{category:r.category}:{}),...(r.country_id?{countryId:r.country_id}:{}),...(r.note?{note:r.note}:{})})),
    memories:await Promise.all((memories||[]).map(async(r:any)=>({id:r.id,tripId:r.trip_id,...(r.place_id?{placeId:r.place_id}:{}),...(r.person_id?{personId:r.person_id}:{}),title:r.title,...(r.body?{body:r.body}:{}),...(r.memory_date?{memoryDate:r.memory_date}:{}),...(r.photo_path?{photoUrl:await sign(r.photo_path)}:{})}))),
    photos:await Promise.all((media||[]).map(async(r:any)=>({id:r.id,tripId:r.trip_id,storagePath:r.storage_path,...(r.caption?{caption:r.caption}:{}),signedUrl:await sign(r.storage_path)}))),
  }
}

export async function addTripPlace(input:{tripId:string;name:string;category?:string;countryId?:string;note?:string}) {
  const {error}=await supabase.from('trip_places').insert({trip_id:input.tripId,name:input.name.trim(),category:input.category?.trim()||null,country_id:input.countryId||null,note:input.note?.trim()||null})
  if(error) throw new Error(`Could not add place: ${error.message}`)
}

export async function addTripMemory(input:{tripId:string;title:string;body?:string;placeId?:string;personId?:string;memoryDate?:string}) {
  const {data,error}=await supabase.from('trip_memories').insert({trip_id:input.tripId,title:input.title.trim(),body:input.body?.trim()||null,place_id:input.placeId||null,person_id:input.personId||null,memory_date:input.memoryDate||null}).select('id').single()
  if(error||!data) throw new Error(`Could not add memory: ${error?.message||'Unknown error'}`)
  return data.id as string
}

function dataUrlToBlob(dataUrl:string){
  const [header,encoded]=dataUrl.split(',',2); const mime=header.match(/^data:([^;]+);base64$/)?.[1]
  if(!mime||!encoded) throw new Error('Invalid image data')
  const binary=atob(encoded); const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i)
  return {blob:new Blob([bytes],{type:mime}),mime,ext:(mime.split('/')[1]||'webp').replace('jpeg','jpg')}
}

export async function uploadTripPhoto(input:{atlasId:string;tripId:string;dataUrl:string;caption?:string}) {
  const {blob,mime,ext}=dataUrlToBlob(input.dataUrl); const path=`${input.atlasId}/trips/${input.tripId}/${crypto.randomUUID()}.${ext}`
  const {error:ue}=await supabase.storage.from('atlas-media').upload(path,blob,{contentType:mime,upsert:false})
  if(ue) throw new Error(`Could not upload trip photo: ${ue.message}`)
  const {error}=await supabase.from('trip_media').insert({trip_id:input.tripId,storage_path:path,caption:input.caption?.trim()||null})
  if(error) throw new Error(`Could not save trip photo: ${error.message}`)
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