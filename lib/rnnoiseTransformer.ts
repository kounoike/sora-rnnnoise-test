import { Rnnoise } from '@shiguredo/rnnoise-wasm'

export function getRnnoiseTransformer (
  rnnoise: Rnnoise
): (
  audioData: AudioData,
  controller: TransformStreamDefaultController<AudioData>
) => void {
  let buffer = new Float32Array()
  return (
    audioData: AudioData,
    controller: TransformStreamDefaultController<AudioData>
  ) => {
    // console.log(
    //   'audioData',
    //   audioData,
    //   rnnoise
    // )
    const opts = { planeIndex: 0 }
    const size = audioData.numberOfFrames
    if (buffer.length < size) {
      buffer = new Float32Array(audioData.numberOfFrames)
    }
    audioData.copyTo(buffer, opts)
    const buffer2 = new Float32Array(buffer)
    const vad = rnnoise.processFrame(buffer)
    const newAudioData = new AudioData({
      format: audioData.format,
      numberOfChannels: audioData.numberOfChannels,
      numberOfFrames: audioData.numberOfFrames,
      sampleRate: audioData.sampleRate,
      timestamp: audioData.timestamp,
      data: buffer
    })
    console.log(buffer, buffer2)
    controller.enqueue(newAudioData)
  }
}
