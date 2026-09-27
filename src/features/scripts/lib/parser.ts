import type { IntExt, TimeOfDay, ScriptFileType } from '@/types/database'
import { XMLParser } from 'fast-xml-parser'

export interface ParsedScene {
  sceneNumber: string
  heading: string
  intExt: IntExt
  locationName: string
  timeOfDay: TimeOfDay
  pageStart: number
  pageEnd: number
  description: string
  estimatedDuration: number // in seconds (e.g., 60s per page)
}

export interface ParsedPage {
  pageNumber: number
  rawText: string
}

export interface ScriptParseResult {
  fileType: ScriptFileType
  totalPages: number
  pages: ParsedPage[]
  scenes: ParsedScene[]
}

import { parseSlugline } from './slugline'
export { parseSlugline }

/**
 * Extract scenes from an array of segmented screenplay pages
 * Captures full scene text (slugline, action, characters, dialogue) for each scene
 */
export function extractScenesFromPages(pages: ParsedPage[]): ParsedScene[] {
  const allLines: { text: string; pageNumber: number }[] = []
  pages.forEach((p) => {
    const lines = p.rawText.split(/\r?\n/)
    lines.forEach((l) => {
      allLines.push({ text: l, pageNumber: p.pageNumber })
    })
  })

  interface SceneWithLines extends ParsedScene {
    lines: string[]
  }

  const scenes: ParsedScene[] = []
  let currentScene: SceneWithLines | null = null
  let autoSceneIndex = 1

  for (const item of allLines) {
    const trimmed = item.text.trim()
    const parsed = parseSlugline(trimmed)

    if (parsed) {
      if (currentScene) {
        currentScene.description = currentScene.lines.join('\n').trim()
        scenes.push(currentScene)
      }

      const sceneNumber = parsed.explicitNum
        ? parsed.explicitNum.replace(/^#/, '')
        : String(autoSceneIndex)
      autoSceneIndex++

      currentScene = {
        sceneNumber,
        heading: trimmed,
        intExt: parsed.intExt,
        locationName: parsed.locationName,
        timeOfDay: parsed.timeOfDay,
        pageStart: item.pageNumber,
        pageEnd: item.pageNumber,
        description: '',
        estimatedDuration: 60,
        lines: [item.text],
      }
    } else if (currentScene) {
      currentScene.lines.push(item.text)
      currentScene.pageEnd = item.pageNumber
    }
  }

  if (currentScene) {
    currentScene.description = currentScene.lines.join('\n').trim()
    scenes.push(currentScene)
  }

  // Calculate estimated duration based on page length (1 page ≈ 60s)
  scenes.forEach((scene) => {
    const pageSpan = Math.max(0.25, scene.pageEnd - scene.pageStart + 0.5)
    scene.estimatedDuration = Math.round(pageSpan * 60)
  })

  return scenes
}

/**
 * Parse plain text or Fountain screenplay content
 */
export function parseScreenplayText(rawContent: string): {
  pages: ParsedPage[]
  scenes: ParsedScene[]
} {
  const cleanContent = rawContent.replace(/\0/g, '')

  // Try form feed \f page splitting first, fallback to line counting (~54 lines per screenplay page)
  let rawPages = cleanContent.split(/\f/)
  if (rawPages.length <= 1) {
    const lines = cleanContent.split(/\r?\n/)
    const LINES_PER_PAGE = 54
    rawPages = []
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      rawPages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'))
    }
  }

  const pages: ParsedPage[] = rawPages
    .map((text, idx) => ({
      pageNumber: idx + 1,
      rawText: text.trim(),
    }))
    .filter((p) => p.rawText.length > 0)

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, rawText: cleanContent.trim() })
  }

  const scenes = extractScenesFromPages(pages)
  return { pages, scenes }
}

/**
 * Parse Final Draft (.fdx) XML screenplay
 */
export function parseFdxBuffer(buffer: Buffer): ScriptParseResult {
  const xmlStr = buffer.toString('utf-8')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })
  const parsed = parser.parse(xmlStr)

  const paragraphs: Array<{ type: string; text: string; sceneNumber?: string }> = []
  const content = parsed?.FinalDraft?.Content?.Paragraph

  if (Array.isArray(content)) {
    content.forEach((p: any) => {
      const type = p['@_Type'] || 'Action'
      let text = ''
      if (typeof p.Text === 'string') {
        text = p.Text
      } else if (Array.isArray(p.Text)) {
        text = p.Text.map((t: any) => (typeof t === 'string' ? t : t['#text'] || '')).join('')
      } else if (p.Text && p.Text['#text']) {
        text = p.Text['#text']
      }

      const sceneNum = p?.SceneProperties?.['@_Number']
      paragraphs.push({ type, text: text.trim(), sceneNumber: sceneNum })
    })
  }

  // Convert paragraphs into page text
  const fullTextLines = paragraphs.map((p) => {
    if (p.type === 'Scene Heading') {
      return p.sceneNumber ? `${p.sceneNumber} ${p.text} ${p.sceneNumber}` : p.text
    }
    if (p.type === 'Character') {
      return `\n${p.text.toUpperCase()}`
    }
    return p.text
  })

  const rawFullText = fullTextLines.join('\n')
  const { pages, scenes } = parseScreenplayText(rawFullText)

  return {
    fileType: 'FDX',
    totalPages: Math.max(1, pages.length),
    pages,
    scenes,
  }
}

function setupNodePdfPolyfills() {
  const g = globalThis as any
  if (!g.DOMMatrix) {
    try {
      const canvas = require('@napi-rs/canvas')
      if (canvas.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix
      if (canvas.ImageData) g.ImageData = canvas.ImageData
      if (canvas.Path2D) g.Path2D = canvas.Path2D
    } catch {
      // ignore
    }
  }

  if (!g.DOMMatrix) {
    class DOMMatrixFallback {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      m11 = 1; m12 = 0; m13 = 0; m14 = 0
      m21 = 0; m22 = 1; m23 = 0; m24 = 0
      m31 = 0; m32 = 0; m33 = 1; m34 = 0
      m41 = 0; m42 = 0; m43 = 0; m44 = 1
      is2D = true
      isIdentity = true

      constructor(init?: any) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = this.m11 = Number(init[0]) || 1
          this.b = this.m12 = Number(init[1]) || 0
          this.c = this.m21 = Number(init[2]) || 0
          this.d = this.m22 = Number(init[3]) || 1
          this.e = this.m41 = Number(init[4]) || 0
          this.f = this.m42 = Number(init[5]) || 0
        }
      }

      multiply() { return this }
      translate() { return this }
      scale() { return this }
      rotate() { return this }
      transformPoint(p: any) { return p }
      toFloat32Array() { return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]) }
      toFloat64Array() { return new Float64Array([this.a, this.b, this.c, this.d, this.e, this.f]) }
      toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})` }
    }
    g.DOMMatrix = DOMMatrixFallback
  }

  if (!g.Path2D) {
    class Path2DFallback {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    g.Path2D = Path2DFallback
  }

  if (!g.ImageData) {
    class ImageDataFallback {
      width: number
      height: number
      data: Uint8ClampedArray
      constructor(w: number, h: number) {
        this.width = w
        this.height = h
        this.data = new Uint8ClampedArray(w * h * 4)
      }
    }
    g.ImageData = ImageDataFallback
  }
}

setupNodePdfPolyfills()

/**
 * Parse PDF Buffer into pages and scenes using PDFParse v2 class / v1 fallback
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ScriptParseResult> {
  setupNodePdfPolyfills()
  const pdfModule = require('pdf-parse')
  const PDFParseClass = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule

  let rawPages: Array<{ pageNumber: number; rawText: string }> = []
  let totalPages = 1

  if (typeof PDFParseClass === 'function' && PDFParseClass.prototype?.getText) {
    const parser = new PDFParseClass({ data: buffer })
    const textResult = await parser.getText()
    await parser.destroy()

    if (Array.isArray(textResult?.pages) && textResult.pages.length > 0) {
      totalPages = textResult.pages.length
      rawPages = textResult.pages.map((p: any, idx: number) => ({
        pageNumber: idx + 1,
        rawText: (p.text || '').replace(/\0/g, '').trim(),
      }))
    } else if (textResult?.text) {
      const split = parseScreenplayText(textResult.text.replace(/\0/g, ''))
      rawPages = split.pages
      totalPages = split.pages.length
    }
  } else {
    // Legacy pdf-parse fallback
    const fn = typeof pdfModule === 'function' ? pdfModule : pdfModule.default
    const data = await fn(buffer)
    const split = parseScreenplayText((data.text || '').replace(/\0/g, ''))
    rawPages = split.pages
    totalPages = data.numpages || split.pages.length
  }

  // Filter out empty pages
  const pages = rawPages.filter((p) => p.rawText.length > 0)
  const scenes = extractScenesFromPages(pages)

  return {
    fileType: 'PDF',
    totalPages: Math.max(totalPages, pages.length),
    pages,
    scenes,
  }
}

/**
 * Master parser for uploaded screenplay buffer
 */
export async function parseScreenplayBuffer(
  fileName: string,
  buffer: Buffer
): Promise<ScriptParseResult> {
  const lowerName = fileName.toLowerCase()

  if (lowerName.endsWith('.fdx')) {
    return parseFdxBuffer(buffer)
  }

  if (lowerName.endsWith('.pdf')) {
    return await parsePdfBuffer(buffer)
  }

  // Plain text / Fountain / Other
  const text = buffer.toString('utf-8')
  const { pages, scenes } = parseScreenplayText(text)
  return {
    fileType: 'TXT',
    totalPages: Math.max(1, pages.length),
    pages,
    scenes,
  }
}
