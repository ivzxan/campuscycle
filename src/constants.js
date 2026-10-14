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
