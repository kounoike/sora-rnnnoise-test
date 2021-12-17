import { NextPage } from 'next'
import Head from 'next/head'
import Webcam from 'react-webcam'
import { Button, Form, Input, Select } from 'antd'
import styles from '../styles/Home.module.css'
import 'antd/dist/antd.css'
import React from 'react'
import { transformAudioStream } from '../lib/transformAudioStream'
import { getRnnoiseTransformer } from '../lib/rnnoiseTransformer'
import { useLocalStorage } from 'react-use'
import Sora, { ConnectionOptions, ConnectionPublisher } from 'sora-js-sdk'
import { Rnnoise } from '@shiguredo/rnnoise-wasm'

const Home: NextPage = () => {
  const [videoDeviceId, setVideoDeviceId] = useLocalStorage('videoDeviceId', '')
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([])
  const [audioDeviceId, setAudioDeviceId] = useLocalStorage('audioDeviceId', '')
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([])
  const [channelId, setChannelId] = useLocalStorage<string>('channelId', '')
  const [signalingKey, setSignalingKey] = useLocalStorage<string>(
    'signalingKey',
    ''
  )
  const [connected, setConnected] = React.useState(false)
  const [sendonly, setSendonly] = React.useState<ConnectionPublisher | null>(
    null
  )
  const [stopFunc, setStopFunc] = React.useState<() => void>(() => () => {
    console.log('default stop func')
  })
  const webcamRef = React.useRef<Webcam>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [transformedStream, setTransformedStream] = React.useState<
    MediaStream
  >()

  const handleSelectVideoDevice = (selectedId: string) => {
    setVideoDeviceId(selectedId)
  }
  const handleSelectAudioDevice = (selectedId: string) => {
    setAudioDeviceId(selectedId)
  }

  const handleDevices = React.useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      setVideoDevices(mediaDevices.filter(({ kind }) => kind === 'videoinput'))
      setAudioDevices(mediaDevices.filter(({ kind }) => kind === 'audioinput'))
    },
    [setVideoDevices, setAudioDevices]
  )

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices)
  }, [handleDevices])

  const onStreamChanged = async (stream: MediaStream) => {
    console.log('onStreamChanged', stream)
    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length > 0) {
      const id = videoTracks[0].getSettings().deviceId
      if (id && videoDeviceId === '') {
        setVideoDeviceId(id)
      }
    }
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length > 0) {
      const id = audioTracks[0].getSettings().deviceId
      if (id && audioDeviceId === '') {
        setAudioDeviceId(id)
      }
    }
    console.log('call stopFunc')
    stopFunc()
    console.log('done.')

    if (videoDevices.length === 1 && videoDevices[0].deviceId === '') {
      navigator.mediaDevices.enumerateDevices().then(handleDevices)
    }

    if (!videoRef.current) {
      console.log('videoRef is null')
      return
    }
    if (!webcamRef.current) {
      console.log('webcamRef is null')
      return
    }
    console.log('call transformStream')
    const rnnoise = await Rnnoise.load('/rnnoise.wasm')
    const { stream: newStream, stop } = transformAudioStream(
      stream,
      // getTestTransformer()
      getRnnoiseTransformer(rnnoise)
    )
    setTransformedStream(newStream)
    setStopFunc(() => stop)

    console.log('set videoRef')
    videoRef.current.onloadedmetadata = ev => {
      ;(ev.target as HTMLVideoElement).play()
    }
    videoRef.current.srcObject = newStream
    console.log('set videoRef done.')
  }
  React.useEffect(() => {
    if (!channelId) return
    const sora = Sora.connection([
      'wss://node-01.sora-labo.shiguredo.jp/signaling',
      'wss://node-02.sora-labo.shiguredo.jp/signaling',
      'wss://node-03.sora-labo.shiguredo.jp/signaling',
      'wss://node-04.sora-labo.shiguredo.jp/signaling',
      'wss://node-05.sora-labo.shiguredo.jp/signaling'
    ])
    const metadata = {
      signaling_key: signalingKey
    }
    const options: ConnectionOptions = {
      multistream: true,
      video: true,
      audio: true
    }
    console.log('create sendonly', metadata, options)
    const sendonly = sora.sendonly(channelId, metadata, options)
    setSendonly(prev => {
      prev?.disconnect()
      return sendonly
    })
  }, [channelId, signalingKey])

  const toggleConnect = React.useCallback(() => {
    if (connected) {
      sendonly?.disconnect()
      setConnected(false)
    } else {
      console.log('transformedStream:', transformedStream)
      console.log(
        transformedStream?.getAudioTracks(),
        transformedStream?.getVideoTracks()
      )
      if (!transformedStream) return
      console.log('connect to sora...')
      sendonly?.connect(transformedStream)
      console.log('done', sendonly)
      setConnected(true)
    }
  }, [transformedStream, connected, setConnected])

  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name='description' content='Generated by create next app' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <main className={styles.main}>
        <Form className={styles.devices}>
          <Form.Item label='channel'>
            <Input
              type='text'
              value={channelId}
              onChange={ev => {
                setChannelId(ev.target.value)
              }}
            ></Input>
          </Form.Item>
          <Form.Item label='Signaling Key'>
            <Input
              type='password'
              value={signalingKey}
              onChange={ev => {
                setSignalingKey(ev.target.value)
              }}
            ></Input>
          </Form.Item>
          <Form.Item label='Video Device'>
            <Select onSelect={handleSelectVideoDevice} value={videoDeviceId}>
              {videoDevices.map((device, key) => (
                <Select.Option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label='Audio Device'>
            <Select onSelect={handleSelectAudioDevice} value={audioDeviceId}>
              {audioDevices.map((device, key) => (
                <Select.Option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Button onClick={() => toggleConnect()}>
            {connected ? 'Disconnect' : 'Connect'}
          </Button>
        </Form>
        <div>
          <Webcam
            videoConstraints={{
              deviceId: videoDeviceId,
              width: 640,
              height: 480
            }}
            audio={true}
            muted={true}
            audioConstraints={{ deviceId: audioDeviceId }}
            onUserMedia={onStreamChanged}
            ref={webcamRef}
            className='input'
            controls={true}
          ></Webcam>
          <video ref={videoRef} muted={false} controls={true}></video>
        </div>
      </main>

      <footer className={styles.footer}></footer>
    </div>
  )
}

export default Home
