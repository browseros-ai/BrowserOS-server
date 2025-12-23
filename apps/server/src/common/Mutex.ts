/**
 * @license
 * Copyright 2025 BrowserOS
 */
export class Mutex {
  static Guard = class Guard {
    #mutex: Mutex
    constructor(mutex: Mutex) {
      this.#mutex = mutex
    }
    dispose(): void {
      this.#mutex.release()
    }
  }

  #locked = false
  #acquirers: Array<() => void> = []

  // This is FIFO.
  async acquire(): Promise<InstanceType<typeof Mutex.Guard>> {
    if (!this.#locked) {
      this.#locked = true
      return new Mutex.Guard(this)
    }
    const { resolve, promise } = Promise.withResolvers<void>()
    this.#acquirers.push(resolve)
    await promise
    return new Mutex.Guard(this)
  }

  release(): void {
    const resolve = this.#acquirers.shift()
    if (!resolve) {
      this.#locked = false
      return
    }
    resolve()
  }
}
