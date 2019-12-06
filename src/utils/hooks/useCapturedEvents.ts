/* eslint-disable react-hooks/exhaustive-deps */

/**
 * ! Call this hook inside Shadow Root!
 */
export function useCapturedInput(
    ref: React.MutableRefObject<HTMLInputElement | undefined | null>,
    onChange: (newVal: string) => void,
    deps: any[] = [],
) {
    const stop = React.useCallback((e: Event) => e.stopPropagation(), deps)
    const use = React.useCallback(
        (e: Event) => onChange((e.currentTarget as HTMLInputElement).value),
        [onChange].concat(deps),
    )
    function binder<T extends keyof HTMLElementEventMap>(keys: T[], fn: (e: HTMLElementEventMap[T]) => void) {
        return () => {
            if (!ref.current) return
            keys.forEach(k => ref.current!.addEventListener(k, fn, true))
            return () => {
                if (!ref.current) return
                keys.forEach(k => ref.current!.removeEventListener(k, fn, true))
            }
        }
    }
    React.useEffect(binder(['input'], use), [ref.current].concat(deps))
    React.useEffect(
        binder(
            [
                'paste',
                'keydown',
                'keypress',
                'keyup',
                'input',
                'drag',
                'dragend',
                'dragenter',
                'dragexit',
                'dragleave',
                'dragover',
                'dragstart',
                'change',
            ],
            stop,
        ),
        [ref.current].concat(deps),
    )
    return binder
}
