class PCMEncoder extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0]
    if (!input) return true

    const buf = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    this.port.postMessage(buf.buffer, [buf.buffer])
    return true
  }
}

registerProcessor('pcm-encoder', PCMEncoder)