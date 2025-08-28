import { useRef, useEffect } from 'react'

import { formatAudioTimestamp } from '../utils/audio-utils'
import type { TranscriberData } from '../hooks/use-transcriber'

interface Props {
  transcribedData: TranscriberData | undefined
}

export function Transcript({ transcribedData }: Props) {
  const divRef = useRef<HTMLDivElement>(null)

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()

    URL.revokeObjectURL(url)
  }

  const exportTXT = () => {
    let chunks = transcribedData?.chunks ?? []
    let text = chunks
      .map((chunk) => chunk.text)
      .join('')
      .trim()

    const blob = new Blob([text], { type: 'text/plain' })
    saveBlob(blob, 'transcript.txt')
  }

  const exportJSON = () => {
    let jsonData = JSON.stringify(transcribedData?.chunks ?? [], null, 2)

    const regex = /(    'timestamp': )\[\s+(\S+)\s+(\S+)\s+\]/gm
    jsonData = jsonData.replace(regex, '$1[$2 $3]')

    const blob = new Blob([jsonData], { type: 'application/json' })
    saveBlob(blob, 'transcript.json')
  }

  useEffect(() => {
    if (!!divRef.current) {
      const diff = Math.abs(
        divRef.current.offsetHeight +
        divRef.current.scrollTop -
        divRef.current.scrollHeight
      )

      if (diff <= 64) {
        divRef.current.scrollTop = divRef.current.scrollHeight
      }
    }
  })

  return (
    <div
      ref={divRef}
      className='w-full flex flex-col my-2 p-4 max-h-[20rem] overflow-y-auto'
    >
      {!!transcribedData?.chunks && transcribedData.chunks.map((chunk, i) => (
        <div
          key={`${i}-${chunk.text}`}
          className='w-full flex flex-row mb-2 bg-white rounded-lg p-4 shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
        >
          <div className='mr-5'>
            {formatAudioTimestamp(chunk.timestamp[0])}
          </div>

          {chunk.text}
        </div>
      ))}

      {!!transcribedData && !transcribedData.isBusy && (
        <div className='w-full text-right'>
          <button
            onClick={exportTXT}
            className='text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 inline-flex items-center'
          >
            Export TXT
          </button>

          <button
            onClick={exportJSON}
            className='text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 inline-flex items-center'
          >
            Export JSON
          </button>
        </div>
      )}
    </div>
  )
}
