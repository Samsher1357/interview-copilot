class PCMEncoder extends AudioWorkletProcessor {
  constructor() {
    super()
    // Pre-allocate buffer for common frame size (128 samples)
    this.buffer = new Int16Array(128)
  }

  process(inputs) {
    const input = inputs[0][0]
    if (!input) return true

    // Resize buffer only if needed (rare)
    if (this.buffer.length !== input.length) {
      this.buffer = new Int16Array(input.length)
    }

    // Convert float32 to int16
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      this.buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    // Clone buffer for transfer (transferable objects)
    const transferBuffer = this.buffer.slice().buffer
    this.port.postMessage(transferBuffer, [transferBuffer])
    return true
  }
}

registerProcessor('pcm-encoder', PCMEncoder)