'use client'

import type { ClipboardEvent, KeyboardEvent } from 'react'
import { useRef } from 'react'

/**
 * Segmented one-time-code entry. Behaves like the OTP fields users already know
 * from banking and SSO flows: type to advance, backspace to retreat, paste to fill.
 */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  label,
  invalid = false,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  length?: number
  label: string
  invalid?: boolean
  disabled?: boolean
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.padEnd(length, ' ').slice(0, length).split('')

  const focusAt = (index: number) => {
    const target = inputs.current[Math.max(0, Math.min(index, length - 1))]
    target?.focus()
    target?.select()
  }

  const commit = (next: string) => {
    onChange(next.replace(/\D/g, '').slice(0, length))
  }

  const handleInput = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return

    // Treat the boxes as one text field so the value can never develop holes:
    // typing lands at the caret, or at the first empty box if the user jumped ahead.
    const at = Math.min(index, value.length)
    const chars = value.split('')
    for (let offset = 0; offset < typed.length && at + offset < length; offset += 1) {
      chars[at + offset] = typed[offset]
    }
    commit(chars.join(''))
    focusAt(at + typed.length)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const chars = value.split('')
      // Delete the digit under the caret, or the one before it when the box is empty.
      const removeAt = chars[index] === undefined ? index - 1 : index
      if (removeAt < 0) return
      chars.splice(removeAt, 1)
      commit(chars.join(''))
      focusAt(removeAt)
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    commit(pasted)
    focusAt(pasted.length)
  }

  return (
    <div aria-label={label} className="flex gap-2 sm:gap-3" role="group">
      {digits.map((digit, index) => (
        <input
          aria-invalid={invalid}
          aria-label={`${label}, digit ${index + 1} of ${length}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className={`h-14 w-full min-w-0 rounded-lg border-2 bg-white text-center text-xl font-bold tabular-nums text-slate-950 outline-none transition sm:h-16 sm:text-2xl ${
            invalid
              ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
              : digit.trim()
                ? 'border-blue-500 focus:ring-4 focus:ring-blue-100'
                : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
          } disabled:cursor-not-allowed disabled:bg-slate-100`}
          disabled={disabled}
          inputMode="numeric"
          key={index}
          maxLength={length}
          onChange={(event) => handleInput(index, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          ref={(element) => {
            inputs.current[index] = element
          }}
          type="text"
          value={digit.trim()}
        />
      ))}
    </div>
  )
}
