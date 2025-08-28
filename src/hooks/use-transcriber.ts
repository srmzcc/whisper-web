import { useCallback, useMemo, useState } from 'react'

import { useWorker } from './use-worker'
import constants from '../utils/constants'

interface ProgressItem {
  file: string
  loaded: number
  progress: number
  total: number
  name: string
  status: string
}

interface TranscriberUpdateData {
  data: [
    string,
    {
      chunks: {
        text: string
        timestamp: [number, number | null]
      }[]
    }
  ]
  text: string
}

interface TranscriberCompleteData {
  data: {
    text: string
    chunks: {
      text: string
      timestamp: [number, number | null]
    }[]
  }
}

export interface TranscriberData {
  isBusy: boolean
  text: string
  chunks: {
    text: string
    timestamp: [number, number | null]
  }[]
}

export interface Transcriber {
  onInputChange: () => void
  isBusy: boolean
  isModelLoading: boolean
  progressItems: ProgressItem[]
  start: (audioData: AudioBuffer | undefined) => void
  output?: TranscriberData
  model: string
  setModel: (model: string) => void
  multilingual: boolean
  setMultilingual: (model: boolean) => void
  quantized: boolean
  setQuantized: (model: boolean) => void
  subtask: string
  setSubtask: (subtask: string) => void
  language?: string
  setLanguage: (language: string) => void
}

export function useTranscriber(): Transcriber {
  const [transcript, setTranscript] = useState<TranscriberData | undefined>()
  const [isBusy, setIsBusy] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)

  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])

  const webWorker = useWorker((event) => {
    const message = event.data
    switch (message.status) {
      case 'progress':
        setProgressItems((prev) =>
          prev.map((item) => {
            if (item.file === message.file) {
              return { ...item, progress: message.progress }
            }
            return item
          })
        )

        break
      case 'update':
        const updateMessage = message as TranscriberUpdateData
        setTranscript({
          isBusy: true,
          text: updateMessage.data[0],
          chunks: updateMessage.data[1].chunks
        })

        break
      case 'complete':
        const completeMessage = message as TranscriberCompleteData
        setTranscript({
          isBusy: false,
          text: completeMessage.data.text,
          chunks: completeMessage.data.chunks
        })

        setIsBusy(false)

        break

      case 'initiate':
        setIsModelLoading(true)
        setProgressItems((prev) => [...prev, message])

        break
      case 'ready':
        setIsModelLoading(false)

        break
      case 'error':
        setIsBusy(false)

        break
      case 'done':
        setProgressItems((prev) =>
          prev.filter((item) => item.file !== message.file)
        )

        break
      default:
        break
    }
  })

  const [model, setModel] = useState<string>(constants.DEFAULT_MODEL)
  const [subtask, setSubtask] = useState<string>(constants.DEFAULT_SUBTASK)
  const [quantized, setQuantized] = useState<boolean>(constants.DEFAULT_QUANTIZED)
  const [multilingual, setMultilingual] = useState<boolean>(constants.DEFAULT_MULTILINGUAL)
  const [language, setLanguage] = useState<string>(constants.DEFAULT_LANGUAGE)

  const onInputChange = useCallback(() => {
    setTranscript(undefined)
  }, [])

  const postRequest = useCallback(async (audioData: AudioBuffer | undefined) => {
    if (!!audioData) {
      setTranscript(undefined)
      setIsBusy(true)

      let audio
      if (audioData.numberOfChannels === 2) {
        const SCALING_FACTOR = Math.sqrt(2)

        let left = audioData.getChannelData(0)
        let right = audioData.getChannelData(1)

        audio = new Float32Array(left.length)
        for (let i = 0; i < audioData.length; ++i) {
          audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2
        }
      } else {
        audio = audioData.getChannelData(0)
      }

      webWorker.postMessage({
        audio,
        model,
        multilingual,
        quantized,
        subtask: multilingual ? subtask : null,
        language: multilingual && language !== 'auto' ? language : null
      })
    }
  }, [webWorker, model, multilingual, quantized, subtask, language])

  const transcriber = useMemo(() => {
    return {
      onInputChange,
      isBusy,
      isModelLoading,
      progressItems,
      start: postRequest,
      output: transcript,
      model,
      setModel,
      multilingual,
      setMultilingual,
      quantized,
      setQuantized,
      subtask,
      setSubtask,
      language,
      setLanguage
    }
  }, [
    isBusy,
    isModelLoading,
    progressItems,
    postRequest,
    transcript,
    model,
    multilingual,
    quantized,
    subtask,
    language
  ])

  return transcriber
}
