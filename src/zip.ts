export type ZipEntry = Readonly<{ name: string; data: Uint8Array }>

const crcTable = ((): Uint32Array => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const dosTime = (date: Date): number =>
  (date.getHours() << 11) |
  (date.getMinutes() << 5) |
  Math.floor(date.getSeconds() / 2)

const dosDate = (date: Date): number =>
  ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
  ((date.getMonth() + 1) << 5) |
  date.getDate()

/** Uncompressed (stored) ZIP archive. */
export const createZip = (
  entries: ReadonlyArray<ZipEntry>,
  date: Date,
): Uint8Array<ArrayBuffer> => {
  const encoder = new TextEncoder()
  const names = entries.map(entry => encoder.encode(entry.name))
  const localSize = entries.reduce(
    (total, entry, index) =>
      total + 30 + (names[index]?.length ?? 0) + entry.data.length,
    0,
  )
  const centralSize = names.reduce((total, name) => total + 46 + name.length, 0)
  const output = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(output.buffer)
  const time = dosTime(date)
  const day = dosDate(date)
  const offsets: Array<number> = []
  let cursor = 0
  entries.forEach((entry, index) => {
    const name = names[index] ?? new Uint8Array()
    const crc = crc32(entry.data)
    offsets.push(cursor)
    view.setUint32(cursor, 0x04034b50, true)
    view.setUint16(cursor + 4, 20, true)
    view.setUint16(cursor + 6, 0x0800, true)
    view.setUint16(cursor + 8, 0, true)
    view.setUint16(cursor + 10, time, true)
    view.setUint16(cursor + 12, day, true)
    view.setUint32(cursor + 14, crc, true)
    view.setUint32(cursor + 18, entry.data.length, true)
    view.setUint32(cursor + 22, entry.data.length, true)
    view.setUint16(cursor + 26, name.length, true)
    view.setUint16(cursor + 28, 0, true)
    output.set(name, cursor + 30)
    output.set(entry.data, cursor + 30 + name.length)
    cursor += 30 + name.length + entry.data.length
  })
  const centralStart = cursor
  entries.forEach((entry, index) => {
    const name = names[index] ?? new Uint8Array()
    view.setUint32(cursor, 0x02014b50, true)
    view.setUint16(cursor + 4, 20, true)
    view.setUint16(cursor + 6, 20, true)
    view.setUint16(cursor + 8, 0x0800, true)
    view.setUint16(cursor + 10, 0, true)
    view.setUint16(cursor + 12, time, true)
    view.setUint16(cursor + 14, day, true)
    view.setUint32(cursor + 16, crc32(entry.data), true)
    view.setUint32(cursor + 20, entry.data.length, true)
    view.setUint32(cursor + 24, entry.data.length, true)
    view.setUint16(cursor + 28, name.length, true)
    view.setUint32(cursor + 42, offsets[index] ?? 0, true)
    output.set(name, cursor + 46)
    cursor += 46 + name.length
  })
  view.setUint32(cursor, 0x06054b50, true)
  view.setUint16(cursor + 8, entries.length, true)
  view.setUint16(cursor + 10, entries.length, true)
  view.setUint32(cursor + 12, cursor - centralStart, true)
  view.setUint32(cursor + 16, centralStart, true)
  return output
}
