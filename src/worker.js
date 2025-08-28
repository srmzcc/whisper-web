import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

class PipelineFactory {
  static task = null;
  static model = null;
  static quantized = null;
  static instance = null;

  constructor(tokenizer, model, quantized) {
    this.tokenizer = tokenizer;
    this.model = model;
    this.quantized = quantized;
  }

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        quantized: this.quantized,
        progress_callback,

        revision: this.model.includes('/whisper-medium') ? 'no_attentions' : 'main'
      });
    }

    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const message = event.data;

  let transcript = await transcribe(
    message.audio,
    message.model,
    message.multilingual,
    message.quantized,
    message.subtask,
    message.language,
  );
  if (transcript === null) return;

  self.postMessage({
    status: 'complete',
    task: 'automatic-speech-recognition',
    data: transcript,
  });
});

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
  static task = 'automatic-speech-recognition';
  static model = null;
  static quantized = null;
}

async function transcribe(
  audio,
  model,
  multilingual,
  quantized,
  subtask,
  language,
) {
  const isDistilWhisper = model.startsWith('distil-whisper/');

  let modelName = model;
  if (!isDistilWhisper && !multilingual) {
    modelName += '.en'
  }

  const p = AutomaticSpeechRecognitionPipelineFactory;
  if (p.model !== modelName || p.quantized !== quantized) {
    p.model = modelName;
    p.quantized = quantized;

    if (p.instance !== null) {
      (await p.getInstance()).dispose();
      p.instance = null;
    }
  }

  let transcriber = await p.getInstance((data) => {
    self.postMessage(data);
  });

  const time_precision =
    transcriber.processor.feature_extractor.config.chunk_length /
    transcriber.model.config.max_source_positions;

  let chunks_to_process = [
    {
      tokens: [],
      finalised: false,
    },
  ];

  const chunk_callback = (chunk) => {
    let last = chunks_to_process[chunks_to_process.length - 1];

    Object.assign(last, chunk);
    last.finalised = true;

    if (!chunk.is_last) {
      chunks_to_process.push({
        tokens: [],
        finalised: false,
      });
    }
  }

  const callback_function = (item) => {
    let last = chunks_to_process[chunks_to_process.length - 1];

    last.tokens = [...item[0].output_token_ids];

    let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
      time_precision: time_precision,
      return_timestamps: true,
      force_full_sequences: false,
    });

    self.postMessage({
      status: 'update',
      task: 'automatic-speech-recognition',
      data: data,
    });
  }

  let output = await transcriber(audio, {
    top_k: 0,
    do_sample: false,

    chunk_length_s: isDistilWhisper ? 20 : 30,
    stride_length_s: isDistilWhisper ? 3 : 5,

    language: language,
    task: subtask,

    return_timestamps: true,
    force_full_sequences: false,

    callback_function: callback_function,
    chunk_callback: chunk_callback,
  }).catch((error) => {
    self.postMessage({
      status: 'error',
      task: 'automatic-speech-recognition',
      data: error,
    });
    
    return null;
  });

  return output;
};
