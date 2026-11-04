import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'

export default function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()))
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])
  useEffect(() => { if (remaining === 0) onExpire?.() }, [remaining, onExpire])
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return <span className={`countdown ${remaining < 60 ? 'countdown--urgent' : ''}`}><Clock3 size={14} /> {remaining === 0 ? 'Price lock expired' : `Price locked ${minutes}:${seconds}`}</span>
}
