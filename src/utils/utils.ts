import { CustomEventId } from './constants'
import { CustomEvents } from '../extension/injected-script/addEventListener'

import { sleep as _sleep, timeout as _timeout } from '@holoflows/kit/es/util/sleep'
import { flatten, isNull, random } from 'lodash-es'

export const sleep = _sleep
export const timeout = _timeout

export const randomElement = (arr: any[]) => {
    const e = flatten(arr)
    return e[random(0, e.length - 1)]
}

/**
 * Get reference of file in both extension and storybook
 */
export function getUrl(path: string, fallback: string = '') {
    if (typeof browser === 'object' && browser.runtime && browser.runtime.getURL) {
        return browser.runtime.getURL(path)
    }
    return fallback || path
}

/**
 * Download given url return as ArrayBuffer
 */
export async function downloadUrl(url: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Fetch failed.')
    return res.arrayBuffer()
}

/**
 * Dispatch a fake event.
 * @param event Event name
 * @param x parameters
 */
export function dispatchCustomEvents<T extends keyof CustomEvents>(event: T, ...x: CustomEvents[T]) {
    document.dispatchEvent(new CustomEvent(CustomEventId, { detail: JSON.stringify([event, x]) }))
}

/**
 * paste image to activeElements
 * @param bytes
 */
export async function pasteImageToActiveElements(bytes: Uint8Array) {
    return dispatchCustomEvents('paste', { type: 'image', value: Array.from(bytes) })
}

Object.assign(globalThis, { dispatchCustomEvents })

/**
 * Select all text in a node
 * @param el Element
 */
export function selectElementContents(el: Node) {
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
}

export const nop = (...args: unknown[]) => {}
// noinspection JSUnusedLocalSymbols
export const nopWithUnmount = (...args: unknown[]) => nop
export const bypass: <T>(args: T) => T = args => args

/**
 * index starts at one.
 */
export const regexMatch: {
    (str: string, regexp: RegExp, index?: number): string | null
    (str: string, regexp: RegExp, index: null): RegExpMatchArray | null
} = (str: string, regexp: RegExp, index: number | null = 1) => {
    const r = str.match(regexp)
    if (isNull(r)) return null
    if (index === null) {
        return (r as RegExpMatchArray) as any
    }
    return (r[index] as string) as any
}

/**
 * enables you to use match group with flag g
 *
 * @return
 *  if no matches, return null;
 *  return target match group in each matches;
 *
 * @example
 *  regexMatchAll(">target<whatever>target2<", />(.+)</)
 *  >>> ["target", "target2"]
 */
export const regexMatchAll = (str: string, regexp: RegExp, index: number = 1) => {
    const gPos = regexp.flags.indexOf('g')
    const withoutG = gPos >= 0 ? `${regexp.flags.slice(0, gPos)}${regexp.flags.slice(gPos + 1)}` : regexp.flags
    const o = new RegExp(regexp.source, withoutG)
    const g = new RegExp(regexp.source, `${withoutG}g`)
    const r = str.match(g)
    if (isNull(r)) {
        return null
    }
    const sto = []
    for (const v of r) {
        const retV = v.match(o)
        if (isNull(retV)) {
            continue
        }
        sto.push(retV[index])
    }
    if (sto.length === 0) {
        return null
    }
    return sto
}

export const isDocument = (node: Node): node is Document => node.nodeType === Node.DOCUMENT_NODE

/**
 * batch run string.replace
 * @param source    the source string to replace
 * @param group     Array of find-replace pair,
 *                  each pair same as the param of
 *                  string.replace
 * @return          result string
 */
export const batchReplace = (source: string, group: Array<[string | RegExp, string]>) => {
    let storage = source
    for (const v of group) {
        storage = storage.replace(v[0], v[1])
    }
    return storage
}
