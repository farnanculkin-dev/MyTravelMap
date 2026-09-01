import React, { useEffect, useRef, useState } from 'react'

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const PICKER_API = 'https://photospicker.googleapis.com/v1'
const MAX_PICK_COUNT = 50

declare global {
  interface Window {
    google?: any
  }
}

type PickedMediaItem = {
  id: string
  type?: string
  mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string }
}

function loadGoogleIdentityScript():Promise<void>{
  if(window.google?.accounts?.oauth2)return Promise.resolve()
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-family-atlas-google-identity]')
    if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Google sign-in could not be loaded.')),{once:true});return}
    const script=document.createElement('script')
    script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.familyAtlasGoogleIdentity='true'
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google sign-in could not be loaded.'))
    document.head.appendChild(script)
  })
}

function blobToDataUrl(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
}

function seconds(duration?:string){const value=Number(String(duration||'2s').replace('s',''));return Number.isFinite(value)?Math.max(value,1):2}

export default function GooglePhotosPickerButton({onPicked,disabled}:{onPicked:(photos:{dataUrl:string;filename?:string}[])=>Promise<void>;disabled?:boolean}){
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const popupRef=useRef<Window|null>(null)
  const clientId=String(import.meta.env.VITE_GOOGLE_PHOTOS_CLIENT_ID||'').trim()

  useEffect(()=>()=>{try{popupRef.current?.close()}catch{/* noop */}},[])

  async function api(url:string,token:string,init?:RequestInit){
    const response=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init?.headers||{})}})
    if(!response.ok){const text=await response.text();throw new Error(`Google Photos request failed (${response.status}). ${text.slice(0,180)}`)}
    if(response.status===204)return null
    return response.json()
  }

  async function importSelection(token:string){
    const session=await api(`${PICKER_API}/sessions`,token,{method:'POST',body:JSON.stringify({pickingConfig:{maxItemCount:String(MAX_PICK_COUNT)}})})
    if(!session?.id||!session?.pickerUri)throw new Error('Google Photos did not start a picker session.')
    const pickerUrl=`${session.pickerUri}/autoclose`
    popupRef.current=window.open(pickerUrl,'family-atlas-google-photos','popup,width=980,height=760')
    if(!popupRef.current)throw new Error('Your browser blocked the Google Photos window. Allow pop-ups for Family Atlas and try again.')

    const started=Date.now();let current=session
    while(!current.mediaItemsSet){
      const waitMs=seconds(current.pollingConfig?.pollInterval)*1000
      const timeoutMs=seconds(current.pollingConfig?.timeoutIn||'300s')*1000
      if(Date.now()-started>timeoutMs)throw new Error('Google Photos selection timed out. Please try again.')
      await new Promise(resolve=>setTimeout(resolve,waitMs))
      current=await api(`${PICKER_API}/sessions/${encodeURIComponent(session.id)}`,token)
    }

    const items:PickedMediaItem[]=[];let pageToken=''
    do{
      const url=new URL(`${PICKER_API}/mediaItems`);url.searchParams.set('sessionId',session.id);url.searchParams.set('pageSize','100');if(pageToken)url.searchParams.set('pageToken',pageToken)
      const page=await api(url.toString(),token)
      items.push(...(page?.mediaItems||[]));pageToken=page?.nextPageToken||''
    }while(pageToken)

    const photos=[] as {dataUrl:string;filename?:string}[]
    for(const item of items){
      if(item.type&&item.type!=='PHOTO')continue
      const baseUrl=item.mediaFile?.baseUrl;if(!baseUrl)continue
      const response=await fetch(`${baseUrl}=d`,{headers:{Authorization:`Bearer ${token}`}})
      if(!response.ok)throw new Error(`Could not download ${item.mediaFile?.filename||'a selected photo'} from Google Photos.`)
      photos.push({dataUrl:await blobToDataUrl(await response.blob()),filename:item.mediaFile?.filename})
    }
    await onPicked(photos)
    try{await api(`${PICKER_API}/sessions/${encodeURIComponent(session.id)}`,token,{method:'DELETE'})}catch{/* session expires automatically */}
  }

  async function choose(){
    if(!clientId){setError('Google Photos is ready in Family Atlas, but the Google client ID still needs to be configured.');return}
    setBusy(true);setError(null)
    try{
      await loadGoogleIdentityScript()
      if(!window.google?.accounts?.oauth2)throw new Error('Google sign-in is unavailable.')
      await new Promise<void>((resolve,reject)=>{
        const tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:GOOGLE_SCOPE,callback:async(response:any)=>{if(response?.error){reject(new Error(response.error_description||response.error));return}try{await importSelection(response.access_token);resolve()}catch(e){reject(e)}}})
        tokenClient.requestAccessToken({prompt:''})
      })
    }catch(e){setError(e instanceof Error?e.message:'Google Photos could not be opened.')}
    finally{setBusy(false)}
  }

  return <div className="google-photos-picker"><button className="secondary-btn" type="button" disabled={disabled||busy} onClick={()=>void choose()}>{busy?'Importing…':'Choose from Google Photos'}</button>{error&&<p className="auth-error">{error}</p>}<p className="trip-form-help">Select several photos in one Google Photos session. Family Atlas imports only the photos you choose.</p></div>
}
