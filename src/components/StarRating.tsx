interface Props {
  value: number
  onChange?: (v: number) => void
  size?: 'sm' | 'md'
}

export function StarRating({ value, onChange, size = 'md' }: Props) {
  const readOnly = !onChange
  const cls = size === 'sm' ? 'text-base' : 'text-xl'
  return (
    <div className={`inline-flex ${cls}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n}점`}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={`${readOnly ? '' : 'cursor-pointer'} px-0.5 leading-none ${
            n <= value ? 'text-amber-400' : 'text-gray-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
