const check = (fileBytes: ArrayLike<number>, offset: number, magicBytes: Uint8Array) => {
  const { length } = magicBytes
  for (let i = 0; i < length; i++) if (fileBytes[offset + i] !== magicBytes[i]) return false

  return true
}

export class FileSignature {
  mimeType: string
  offset: number
  magicByteArrays: Uint8Array[]

  constructor(mimeType: string, offset: number, ...magicByteArrays: Uint8Array[]) {
    this.mimeType = mimeType
    this.offset = offset
    this.magicByteArrays = magicByteArrays
  }

  check(fileBytes: Uint8Array) {
    return this.magicByteArrays.some((b) => check(fileBytes, this.offset, b))
  }
}
