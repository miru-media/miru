export interface ColorRGB {
  R: number
  G: number
  B: number
}

export interface ColorLab {
  L: number
  a: number
  b: number
}

export type Palette = (ColorRGB | ColorLab)[]
