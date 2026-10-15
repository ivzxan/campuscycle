export const TYPES = {
  sell: { label: 'For sale' },
  free: { label: 'Free' },
  swap: { label: 'Swap' },
  looking_for: { label: 'Looking For' },
}

export const CATEGORIES = {
  books: 'Books and reviewers',
  electronics: 'Electronics and components',
  accessories: 'Computer accessories',
  materials: 'Project materials',
  uniforms: 'Uniforms and gear',
  other: 'Other',
}

export const CONDITIONS = {
  new: 'Brand new',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair, works but worn',
}

export const AFFILIATIONS = {
  student: 'Current student',
  graduating: 'Graduating',
  alumni: 'Alumni',
}

export const SUBJECTS = [
  'Programming',
  'Web Development',
  'Database Management',
  'Networking',
  'Arduino and Embedded',
  'Systems Analysis and Design',
  'Mobile Development',
  'Capstone Project',
]

export const peso = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })

export function priceLine(l) {
  if (l.type === 'sell') return peso(l.price)
  if (l.type === 'free') return 'Free'
  if (l.type === 'swap') return l.swap_for ? `Swap for ${l.swap_for}` : 'Open to swaps'
  return 'Someone needs this'
}

export function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const AVATAR_COLORS = {
  indigo: '#3f4bc8',
  teal: '#0e7c86',
  green: '#2e7d32',
  amber: '#b26a00',
  rose: '#c2335a',
  violet: '#7b45c9',
  slate: '#4b5563',
  sky: '#1d6fb8',
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export const clock = (iso) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
