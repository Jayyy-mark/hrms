import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { ok, errors, requirePerm } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'application/pdf']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.STAFF_CREATE)
  if ('response' in auth) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return errors.validation([{ path: ['file'], message: 'No file provided' }])
    if (!ALLOWED_MIME.includes(file.type)) {
      return errors.validation([{ path: ['file'], message: `Unsupported file type: ${file.type}. Allowed: PNG, JPG, WEBP, SVG, PDF` }])
    }
    if (file.size > MAX_SIZE) {
      return errors.validation([{ path: ['file'], message: 'File exceeds the 2MB limit' }])
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, fileName), buffer)

    return ok({ url: `/uploads/${fileName}`, fileName, fileType: file.type, fileSize: file.size })
  } catch (err) {
    console.error('[upload]', err)
    return errors.conflict('Upload failed')
  }
}
