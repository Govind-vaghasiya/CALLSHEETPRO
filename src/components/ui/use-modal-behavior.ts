'use client'

import { useEffect, useRef } from 'react'

/** Open dialogs, innermost last — Esc only closes the top one. */
const openStack: symbol[] = []

/**
 * Standard behaviour for every popup: Esc closes it, the page behind doesn't scroll, and focus
 * moves into the dialog on open and back to where it was on close.
 * Returns a ref for the element that should receive focus when the dialog opens (e.g. its close button).
 */
export function useModalBehavior<T extends HTMLElement = HTMLButtonElement>(isOpen: boolean, onClose: () => void) {
  const initialFocusRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const id = Symbol('modal')
    openStack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    initialFocusRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === id) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openStack.splice(openStack.indexOf(id), 1)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  return initialFocusRef
}
