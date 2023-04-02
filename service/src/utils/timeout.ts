export class MTimeout {
  timeoutMs: number
  _handle
  onTimeout

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs
    this.reset()
  }

  timeOut() {
    this.cancel()

    if (this.onTimeout)
      this.onTimeout.apply(this)
  }

  cancel() {
    if (this._handle)
      clearTimeout(this._handle)
    this._handle = undefined
  }

  reset() {
    this.cancel()

    this._handle = setTimeout(() => {
      this.timeOut()
    }, this.timeoutMs)
  }
}
