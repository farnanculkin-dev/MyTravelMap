import React, { useMemo, useRef, useState } from 'react'

type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string
  onValueChange: (value: string) => void
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type RecognitionConstructor = new () => SpeechRecognitionLike

export default function VoiceTextarea({ value, onValueChange, ...props }: VoiceTextareaProps) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const Recognition = useMemo(() => {
    const browserWindow = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null
  }, [])

  function startListening() {
    if (!Recognition) return
    if (listening) { recognitionRef.current?.stop(); return }
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = navigator.language || 'en-IE'
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0]?.transcript || '').join(' ').trim()
      if (!spoken) return
      onValueChange(`${value}${value.trim() ? ' ' : ''}${spoken}`)
    }
    recognition.onend = () => { setListening(false); recognitionRef.current = null }
    recognition.onerror = () => { setListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  return <div className="voice-field-wrap">
    <textarea {...props} value={value} onChange={(event) => onValueChange(event.target.value)} />
    {Recognition && <div className="voice-field-actions">
      <button className={`voice-btn${listening ? ' listening' : ''}`} type="button" onClick={startListening}>{listening ? '■ Stop listening' : '🎤 Speak instead'}</button>
      <span className="voice-status">{listening ? 'Listening… speak naturally.' : 'Voice is converted to editable text.'}</span>
    </div>}
  </div>
}
