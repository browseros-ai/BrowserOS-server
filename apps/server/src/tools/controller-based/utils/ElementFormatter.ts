/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Interactive Node interface matching the controller response
 */
export interface InteractiveNode {
  nodeId: number
  type: 'clickable' | 'typeable' | 'selectable' | 'other'
  name?: string
  rect?: {
    x: number
    y: number
    width: number
    height: number
  }
  attributes?: {
    in_viewport?: string
    depth?: string
    'html-tag'?: string
    role?: string
    context?: string
    path?: string
    placeholder?: string
    id?: string
    'input-type'?: string
    type?: string
    value?: string
    'aria-label'?: string
    [key: string]: any
  }
}

/**
 * Element Formatter - Formats interactive elements for display
 * Based on BrowserOS-agent ElementFormatter
 */
export class ElementFormatter {
  private simplified: boolean

  constructor(simplified = false) {
    this.simplified = simplified
  }

  /**
   * Format an array of elements
   */
  formatElements(
    elements: InteractiveNode[],
    hideHiddenElements = false,
  ): string {
    const SKIP_OUT_OF_VIEWPORT = hideHiddenElements
    const SORT_BY_NODEID = true
    const MAX_ELEMENTS = 0 // 0 means no limit

    let filteredElements = [...elements]

    if (SKIP_OUT_OF_VIEWPORT) {
      filteredElements = filteredElements.filter(
        (node) => node.attributes?.in_viewport !== 'false',
      )
    }

    if (SORT_BY_NODEID) {
      filteredElements.sort((a, b) => a.nodeId - b.nodeId)
    }

    if (MAX_ELEMENTS > 0) {
      filteredElements = filteredElements.slice(0, MAX_ELEMENTS)
    }

    const lines: string[] = []
    for (const node of filteredElements) {
      const formatted = this.formatElement(node)
      if (formatted) {
        lines.push(formatted)
      }
    }

    if (SKIP_OUT_OF_VIEWPORT) {
      lines.push(
        '--- IMPORTANT: OUT OF VIEWPORT ELEMENTS, SCROLL TO INTERACT ---',
      )
    }

    return lines.join('\n')
  }

  /**
   * Format a single element
   */
  formatElement(node: InteractiveNode): string {
    let SHOW_INDENTATION = true
    const SHOW_NODEID = true
    const SHOW_TYPE = true
    const SHOW_TAG = true
    const SHOW_NAME = true
    let SHOW_CONTEXT = true
    let SHOW_PATH = false
    let SHOW_ATTRIBUTES = true
    const SHOW_VALUE_FOR_TYPEABLE = true
    const APPEND_VIEWPORT_STATUS = true
    const INDENT_SIZE = 2

    if (this.simplified) {
      SHOW_CONTEXT = false
      SHOW_ATTRIBUTES = false
      SHOW_PATH = false
      SHOW_INDENTATION = false
    }

    const parts: string[] = []

    if (SHOW_INDENTATION) {
      const depth = parseInt(node.attributes?.depth || '0', 10)
      const indent = ' '.repeat(INDENT_SIZE * depth)
      parts.push(indent)
    }

    if (SHOW_NODEID) {
      parts.push(`[${node.nodeId}]`)
    }

    if (SHOW_TYPE) {
      parts.push(`<${this._getTypeSymbol(node.type)}>`)
    }

    if (SHOW_TAG) {
      const tag =
        node.attributes?.['html-tag'] || node.attributes?.role || 'div'
      parts.push(`<${tag}>`)
    }

    if (SHOW_NAME && node.name) {
      const truncated = this._truncateText(node.name, 40)
      parts.push(`"${truncated}"`)
    } else if (node.type === 'typeable') {
      const placeholder = node.attributes?.placeholder
      const id = node.attributes?.id
      const inputType = node.attributes?.['input-type'] || 'text'
      if (placeholder) {
        parts.push(`placeholder="${this._truncateText(placeholder, 30)}"`)
      } else if (id) {
        parts.push(`id="${this._truncateText(id, 10)}"`)
      } else {
        parts.push(`type="${inputType}"`)
      }
    }

    if (SHOW_CONTEXT && node.attributes?.context) {
      const truncated = this._truncateText(node.attributes.context, 60)
      parts.push(`ctx:"${truncated}"`)
    }

    if (SHOW_PATH && node.attributes?.path) {
      const formatted = this._formatPath(node.attributes.path)
      if (formatted) {
        parts.push(`path:"${formatted}"`)
      }
    }

    if (SHOW_ATTRIBUTES) {
      const attrString = this._formatAttributes(node)
      if (attrString) {
        parts.push(`attr:"${attrString}"`)
      }
    }

    if (
      SHOW_VALUE_FOR_TYPEABLE &&
      !SHOW_ATTRIBUTES &&
      node.type === 'typeable' &&
      node.attributes?.value
    ) {
      const value = this._truncateText(node.attributes.value, 40)
      parts.push(`value="${value}"`)
    }

    if (APPEND_VIEWPORT_STATUS) {
      const isInViewport = node.attributes?.in_viewport !== 'false'
      parts.push(isInViewport ? '(visible)' : '(hidden)')
    }

    return parts.join(' ')
  }

  private _getTypeSymbol(type: string): string {
    switch (type) {
      case 'clickable':
      case 'selectable':
        return 'C'
      case 'typeable':
        return 'T'
      default:
        return 'O'
    }
  }

  private _truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text
    return `${text.substring(0, maxLength - 3)}...`
  }

  private _formatPath(path: string): string {
    if (!path) return ''
    const PATH_DEPTH = 3

    const parts = path.split(' > ').filter((p) => p && p !== 'root')
    const lastParts = parts.slice(-PATH_DEPTH)

    return lastParts.length > 0 ? lastParts.join('>') : ''
  }

  private _formatAttributes(node: InteractiveNode): string {
    if (!node.attributes) return ''

    const INCLUDE_ATTRIBUTES = ['type', 'placeholder', 'value', 'aria-label']
    const pairs: string[] = []

    for (const key of INCLUDE_ATTRIBUTES) {
      if (key in node.attributes) {
        const value = node.attributes[key]
        if (value !== undefined && value !== null && value !== '') {
          pairs.push(`${key}=${value}`)
        }
      }
    }

    return pairs.join(' ')
  }
}
