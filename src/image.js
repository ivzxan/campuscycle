// Resize and compress a photo in the browser before upload.
// JPEG is used because every browser can encode it.
async function encode(bitmap, maxSide, maxBytes) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  let quality = 0.78
  let blob
  do {
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    quality -= 0.12
  } while (blob && blob.size > maxBytes && quality > 0.3)
  return blob
}

export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file)
  try {
    const main = await encode(bitmap, 900, 450 * 1024)
    const thumb = await encode(bitmap, 360, 60 * 1024)
    if (!main || !thumb) throw new Error('encode failed')
    return { main, thumb, url: URL.createObjectURL(thumb) }
  } finally {
    bitmap.close?.()
  }
}
