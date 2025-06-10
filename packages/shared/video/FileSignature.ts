const check = (fileBytes: Uint8Array, offset: number, magicBytes: Uint8Array) => {
  const { length } = magicBytes
  for (let i = 0; i < length; i++) if (fileBytes[offset + i] !== magicBytes[i]) return false

  return true
}

export class FileSignature {
  offset: number
  magicByteArrays: Uint8Array[]

  constructor(offset: number, ...magicByteArrays: Uint8Array[]) {
    this.offset = offset
    this.magicByteArrays = magicByteArrays
  }

  check(fileBytes: Uint8Array) {
    return this.magicByteArrays.some((b) => check(fileBytes, this.offset, b))
  }
}
