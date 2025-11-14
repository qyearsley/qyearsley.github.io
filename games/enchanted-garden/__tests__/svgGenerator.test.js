/**
 * Tests for SVG Generator utilities
 */
import { describe, test, expect } from '@jest/globals'
import { SVGGenerator } from '../js/utils/svgGenerator.js'

describe('SVGGenerator', () => {
  test('clock should generate valid SVG', () => {
    const svg = SVGGenerator.clock(3, 15)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('circle') // Clock face
    expect(svg).toContain('line') // Clock hands
  })

  test('clock should have all 12 hour numbers', () => {
    const svg = SVGGenerator.clock(12, 0)
    for (let i = 1; i <= 12; i++) {
      expect(svg).toContain(`>${i}</text>`)
    }
  })

  test('ruler should generate SVG with correct length', () => {
    const svg = SVGGenerator.ruler(5)
    expect(svg).toContain('<svg')
    expect(svg).toContain('rect') // Ruler body
    // Should have markings from 0 to 5
    expect(svg).toContain('>0</text>')
    expect(svg).toContain('>5</text>')
  })

  test('scale should include correct number of items', () => {
    const svg = SVGGenerator.scale(4)
    expect(svg).toContain('<svg')
    expect(svg).toContain('⚖️') // Scale emoji
    const appleCount = (svg.match(/🍎/g) || []).length
    expect(appleCount).toBe(4)
  })

  test('castle should show progress', () => {
    const svg0 = SVGGenerator.castle(0)
    const svg3 = SVGGenerator.castle(3)
    const svg6 = SVGGenerator.castle(6)

    // No pieces should have no foundation
    expect(svg0).not.toContain('Foundation')

    // 3 pieces should have foundation, walls, towers
    expect(svg3).toContain('Foundation')
    expect(svg3).toContain('Towers')

    // 6 pieces should have victory elements
    expect(svg6).toContain('Victory')
    expect(svg6).toContain('Castle Complete')
  })

  test('all SVG methods should return valid SVG strings', () => {
    const methods = [
      () => SVGGenerator.clock(12, 30),
      () => SVGGenerator.ruler(8),
      () => SVGGenerator.scale(3),
      () => SVGGenerator.cups(4),
      () => SVGGenerator.castle(4),
    ]

    methods.forEach(method => {
      const result = method()
      expect(typeof result).toBe('string')
      expect(result).toContain('<svg')
      expect(result).toContain('</svg>')
      // Should be valid SVG (no unclosed tags)
      const openTags = (result.match(/<svg/g) || []).length
      const closeTags = (result.match(/<\/svg>/g) || []).length
      expect(openTags).toBe(closeTags)
    })
  })
})
