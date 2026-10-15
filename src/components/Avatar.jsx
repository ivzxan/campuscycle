import { AVATAR_COLORS, initials } from '../constants'

export default function Avatar({ profile, size = 40 }) {
  const bg = AVATAR_COLORS[profile?.avatar_color] || AVATAR_COLORS.indigo
  return (
    <span className="avatar" aria-hidden="true"
      style={{ background: bg, width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials(profile?.display_name)}
    </span>
  )
}
