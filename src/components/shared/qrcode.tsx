import qr from 'qrcode'

export function QrCode(props: {
    text: string
    canvasProps?: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>
}) {
    const ref = React.useRef<HTMLCanvasElement | null>(null)
    React.useEffect(() => {
        if (!ref.current) return
        qr.toCanvas(ref.current, props.text)
    }, [props.text])
    return <canvas {...props.canvasProps} ref={ref} />
}
