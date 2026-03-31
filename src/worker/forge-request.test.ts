import { describe, it, expect } from 'vitest'
import { MAX_IDEA_CHARS, parseForgeIdea } from './forge-request'

describe('forge request parsing', () => {
  it('accepts and trims a valid idea', () => {
    const result = parseForgeIdea({ idea: '  hello singularity  ' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.idea).toBe('hello singularity')
    }
  })

  it('rejects missing idea', () => {
    const result = parseForgeIdea({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('No idea provided')
    }
  })

  it('rejects non-object request body', () => {
    const result = parseForgeIdea('invalid')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Invalid request body')
    }
  })

  it('rejects overly long ideas', () => {
    const result = parseForgeIdea({ idea: 'a'.repeat(MAX_IDEA_CHARS + 1) })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Idea too long')
    }
  })
})
