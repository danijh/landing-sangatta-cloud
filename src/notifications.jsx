import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

export function useNotifications({ enabled, clientId, onNew }) {
  const [notifications, setNotifications] = useState([])
  const [readByTicket, setReadByTicket] = useState({})
  const [clearedId, setClearedId] = useState(0)
  const storageKey = clientId ? `notification-read-${clientId}` : ''

  useEffect(() => {
    if (!enabled) return undefined

    let lastId = 0
    let stopped = false

    const poll = async () => {
      try {
        const response = await fetch(`/api/fossbilling-auth.php?action=notifications&after=${lastId}`, {
          credentials: 'same-origin',
        })
        if (response.status === 401) {
          stopped = true
          return
        }
        const result = await response.json()
        if (!response.ok || !Array.isArray(result.items)) return
        const isFirstPoll = lastId === 0
        lastId = result.lastId
        if (result.items.length > 0) {
          setNotifications((current) => [...current, ...result.items].slice(-50))
          if (!isFirstPoll) onNew?.()
        }
      } catch {
        // Retry on the next interval.
      }
    }

    poll()
    const timer = setInterval(() => {
      if (stopped) {
        clearInterval(timer)
      } else if (!document.hidden) {
        poll()
      }
    }, 5000)

    return () => clearInterval(timer)
    // onNew is intentionally excluded so polling is not restarted on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      setReadByTicket(saved.read && typeof saved.read === 'object' ? saved.read : {})
      setClearedId(Number(saved.cleared) || 0)
    } catch {
      // Ignore unreadable storage.
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ read: readByTicket, cleared: clearedId }))
    } catch {
      // Storage may be unavailable.
    }
  }, [storageKey, readByTicket, clearedId])

  const visible = notifications.filter((item) => item.id > clearedId)
  const isUnread = (item) => item.id > (readByTicket[item.ticketId] || 0)
  const unread = visible.filter(isUnread)

  return {
    visible,
    isUnread,
    unreadCount: unread.length,
    unreadTicketIds: new Set(unread.map((item) => String(item.ticketId))),
    markTicketRead: (ticketId) => {
      const latest = Math.max(0, ...notifications.filter((item) => String(item.ticketId) === String(ticketId)).map((item) => item.id))
      if (latest > 0) setReadByTicket((current) => ({ ...current, [ticketId]: latest }))
    },
    clearAll: () => setClearedId(Math.max(0, ...visible.map((item) => item.id))),
  }
}

const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

export function NotificationBell({ notifications, open, onOpenChange, onSelect }) {
  const { visible, isUnread, unreadCount, clearAll } = notifications

  return (
    <div className="dashboard-notification-wrap" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false)
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }}>
      <button className="dashboard-icon-button" type="button" aria-label="Notifikasi" aria-haspopup="true" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <Bell size={18} />{unreadCount > 0 && <span />}
      </button>
      {open && (
        <div className="dashboard-notification-panel">
          <div className="dashboard-notification-head">
            <strong>Notifikasi</strong>
            {visible.length > 0 && <button type="button" onClick={clearAll}>Hapus semua</button>}
          </div>
          {visible.length === 0 ? <p>Belum ada notifikasi.</p> : (
            <ul>
              {[...visible].reverse().map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelect(item)}>
                    {isUnread(item) && <i className="dashboard-unread-dot" aria-label="Belum dibaca" />}
                    <span>Balasan baru pada tiket</span>
                    <strong>{item.subject || `#${item.ticketId}`}</strong>
                    <small>{formatTime(item.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
