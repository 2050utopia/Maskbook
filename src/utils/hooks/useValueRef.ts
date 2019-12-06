import { ValueRef } from '@holoflows/kit/es'

export function useValueRef<T>(ref: ValueRef<T>) {
    const [value, setValue] = React.useState<T>(ref.value)
    React.useEffect(() => {
        if (ref.isEqual(value, ref.value) === false) {
            // The state is outdated before the React.useEffect runs
            setValue(ref.value)
        }
        return ref.addListener(v => setValue(v))
    }, [ref, value])
    return value
}
