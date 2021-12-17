export function transformAudioStream(
    inputStream: MediaStream,
    transform: (audioData: AudioData, controller: any) => any,
): {stream: MediaStream, stop: () => void} {
    const abort = new AbortController()
    if (inputStream.getAudioTracks().length == 0) {
        throw new Error("no audio tracks")
    }

    console.log("create trackProcessor")
    const trackProcessor = new MediaStreamTrackProcessor({track: inputStream.getAudioTracks()[0]})
    console.log("create trackGenerator")
    const trackGenerator = new MediaStreamTrackGenerator({kind: 'audio'})
    console.log("set Processor.readable pipeline")
    trackProcessor.readable.pipeThrough(new TransformStream({transform}), {signal: abort.signal}).pipeTo(trackGenerator.writable).catch((e) => {
        console.error(e)
        trackProcessor.readable.cancel(e)
        trackGenerator.writable.abort(e)
    })
    console.log("create new MediaStream")
    const outputStream = new MediaStream()
    console.log("addTrack")
    outputStream.addTrack(trackGenerator)
    if (inputStream.getVideoTracks().length > 0) {
        outputStream.addTrack(inputStream.getVideoTracks()[0])
    }
    console.log("ok will return")
    return {
        stream: outputStream,
        stop: () => {
            try{
                console.log("call abort")
                abort.abort()
                console.log("call trackGenerator.stop")
                trackGenerator.stop()
                console.log("stop done.")
            } catch (ex) {
                console.error("stop func:", ex)
            }
        }
    }
}
