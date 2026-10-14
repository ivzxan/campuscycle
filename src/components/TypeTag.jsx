import { TYPES } from '../constants'

export default function TypeTag({ type }) {
  return <span className={`tag tag-${type}`}>{TYPES[type].label}</span>
}
