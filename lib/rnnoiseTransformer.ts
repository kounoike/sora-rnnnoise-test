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
    // 比較用
    const buffer2 = new Float32Array(buffer)
    // convert to 16bit PCM
    for (let i = 0; i < buffer.length; ++i) {
      buffer[i] *= 0x7fff
    }

    // Rnnoiseが480フレームしか処理できないからホントは区切って渡さないといけないんだけど
    // たまたまBreakout boxも480フレームで渡してくるからサボってそのままにしている
    const vad = rnnoise.processFrame(buffer)
    // reverse convert
    for (let i = 0; i < buffer.length; ++i) {
      buffer[i] /= 0x7fff
    }
    const newAudioData = new AudioData({
      format: audioData.format,
      numberOfChannels: audioData.numberOfChannels,
      numberOfFrames: audioData.numberOfFrames,
      sampleRate: audioData.sampleRate,
      timestamp: audioData.timestamp,
      data: buffer
    })

    // 比較表示
    console.log(buffer, buffer2)
    controller.enqueue(newAudioData)
  }
}
