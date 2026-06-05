// 앱 아이콘 생성기 — 외부 디자인 도구 없이 순수 JS로 렌더링.
// 마스터(1024px)에서 하드엣지로 그린 뒤 각 크기로 면적 리샘플(안티앨리어싱),
// Node 내장 zlib로 PNG 인코딩 → 멀티 해상도 .ico 컨테이너로 묶는다.
//
// 디자인: 파란 그라데이션 라운드 사각형 + 상승 라인차트 + 빨간(상승) 화살표.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const N = 1024 // 마스터 해상도
const buf = new Float32Array(N * N * 4) // 프리멀티플라이드 RGBA, 0..1

// ---- 합성(소스 over) ----
function over(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= N || y >= N || a <= 0) return
  const i = (y * N + x) * 4
  const ia = 1 - a
  buf[i] = r * a + buf[i] * ia
  buf[i + 1] = g * a + buf[i + 1] * ia
  buf[i + 2] = b * a + buf[i + 2] * ia
  buf[i + 3] = a + buf[i + 3] * ia
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
]

// ---- 도형 ----
function roundRectInside(px, py, x, y, w, h, rad) {
  const dx = Math.max(x - px, px - (x + w), 0)
  const dy = Math.max(y - py, py - (y + h), 0)
  // 코너 라운딩
  const cx = Math.min(Math.max(px, x + rad), x + w - rad)
  const cy = Math.min(Math.max(py, y + rad), y + h - rad)
  if (px >= x && px <= x + w && py >= y && py <= y + h) {
    const ddx = px - cx
    const ddy = py - cy
    return ddx * ddx + ddy * ddy <= rad * rad || (px > x + rad && px < x + w - rad) || (py > y + rad && py < y + h - rad)
  }
  return dx === 0 && dy === 0
}

function fillRoundRect(x, y, w, h, rad, colorFn, alpha = 1) {
  for (let py = Math.floor(y); py < y + h; py++) {
    for (let px = Math.floor(x); px < x + w; px++) {
      if (roundRectInside(px, py, x, y, w, h, rad)) {
        const c = colorFn(px, py)
        over(px, py, c[0], c[1], c[2], alpha)
      }
    }
  }
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1
  let t = ((px - ax) * dx + (py - ay) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function drawSeg(ax, ay, bx, by, hw, col, alpha = 1) {
  const minx = Math.floor(Math.min(ax, bx) - hw - 1)
  const maxx = Math.ceil(Math.max(ax, bx) + hw + 1)
  const miny = Math.floor(Math.min(ay, by) - hw - 1)
  const maxy = Math.ceil(Math.max(ay, by) + hw + 1)
  for (let py = miny; py <= maxy; py++)
    for (let px = minx; px <= maxx; px++)
      if (distToSeg(px, py, ax, ay, bx, by) <= hw) over(px, py, col[0], col[1], col[2], alpha)
}

function drawDisc(cx, cy, r, col, alpha = 1) {
  for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++)
    for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++)
      if (Math.hypot(px - cx, py - cy) <= r) over(px, py, col[0], col[1], col[2], alpha)
}

function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by)
}
function fillTriangle(p, q, s, col, alpha = 1) {
  const minx = Math.floor(Math.min(p[0], q[0], s[0]))
  const maxx = Math.ceil(Math.max(p[0], q[0], s[0]))
  const miny = Math.floor(Math.min(p[1], q[1], s[1]))
  const maxy = Math.ceil(Math.max(p[1], q[1], s[1]))
  for (let py = miny; py <= maxy; py++)
    for (let px = minx; px <= maxx; px++) {
      const d1 = sign(px, py, p[0], p[1], q[0], q[1])
      const d2 = sign(px, py, q[0], q[1], s[0], s[1])
      const d3 = sign(px, py, s[0], s[1], p[0], p[1])
      const neg = d1 < 0 || d2 < 0 || d3 < 0
      const pos = d1 > 0 || d2 > 0 || d3 > 0
      if (!(neg && pos)) over(px, py, col[0], col[1], col[2], alpha)
    }
}

// ---- 렌더 ----
const cTop = hex('#26334a') // 상단(슬레이트 네이비)
const cBot = hex('#0a0f1a') // 하단(딥 네이비)
const grid = hex('#9fb3c8') // 옅은 그리드
const red = hex('#ff4d4f') // 양봉(상승) — 한국 증시 빨강
const blue = hex('#3b9dff') // 음봉(하락) — 파랑

// 배경: 대각선 그라데이션 라운드 사각형
fillRoundRect(0, 0, N, N, N * 0.235, (px, py) => {
  const t = (px / N) * 0.4 + (py / N) * 0.6
  return [
    cTop[0] + (cBot[0] - cTop[0]) * t,
    cTop[1] + (cBot[1] - cTop[1]) * t,
    cTop[2] + (cBot[2] - cTop[2]) * t,
  ]
})

// 옅은 가로 그리드 (차트 느낌)
for (const gy of [0.34, 0.52, 0.7]) {
  drawSeg(0.13 * N, gy * N, 0.87 * N, gy * N, 0.006 * N, grid, 0.16)
}

// 캔들스틱 — [centerX, openY, closeY, highY, lowY] (0..1, y는 아래로 증가)
// 전체적으로 상승하는 흐름(양봉 우세)
const candles = [
  [0.22, 0.56, 0.64, 0.50, 0.69], // 음봉
  [0.37, 0.62, 0.48, 0.43, 0.65], // 양봉
  [0.5, 0.5, 0.57, 0.45, 0.62], // 음봉
  [0.63, 0.55, 0.36, 0.31, 0.59], // 양봉
  [0.78, 0.42, 0.21, 0.16, 0.46], // 양봉(강)
]
const bodyW = 0.11 * N
const wickW = 0.026 * N
for (const [cxN, oN, clN, hN, lN] of candles) {
  const cx = cxN * N
  const o = oN * N
  const cl = clN * N
  const up = cl < o // 종가가 위(작은 y)면 양봉
  const col = up ? red : blue
  // 심지(고가~저가)
  drawSeg(cx, hN * N, cx, lN * N, wickW / 2, col)
  // 몸통(시가~종가)
  const top = Math.min(o, cl)
  const bot = Math.max(o, cl)
  fillRoundRect(cx - bodyW / 2, top, bodyW, Math.max(bot - top, bodyW * 0.34), bodyW * 0.16, () => col)
}

// ---- 면적 리샘플(프리멀티플라이드 → 스트레이트) ----
function resampleToRGBA8(S) {
  const dst = new Uint8Array(S * S * 4)
  const scale = N / S
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const x0 = Math.floor(x * scale)
      const y0 = Math.floor(y * scale)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scale))
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scale))
      let r = 0, g = 0, b = 0, a = 0, cnt = 0
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * N + sx) * 4
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3]; cnt++
        }
      r /= cnt; g /= cnt; b /= cnt; a /= cnt
      const di = (y * S + x) * 4
      if (a > 0.0001) {
        dst[di] = Math.round(Math.min(1, r / a) * 255)
        dst[di + 1] = Math.round(Math.min(1, g / a) * 255)
        dst[di + 2] = Math.round(Math.min(1, b / a) * 255)
      }
      dst[di + 3] = Math.round(Math.min(1, a) * 255)
    }
  }
  return dst
}

// ---- PNG 인코딩 ----
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return (bytes) => {
    let c = 0xffffffff
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
})()

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(CRC(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(rgba, S) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 10,11,12 = 0
  const raw = Buffer.alloc(S * (S * 4 + 1))
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0 // filter none
    Buffer.from(rgba.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---- ICO 컨테이너(PNG 엔트리) ----
function encodeIco(sizes) {
  const pngs = sizes.map((s) => ({ s, png: encodePng(resampleToRGBA8(s), s) }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type icon
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + pngs.length * 16
  for (const { s, png } of pngs) {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s
    e[1] = s >= 256 ? 0 : s
    e[2] = 0
    e[3] = 0
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bpp
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)])
}

// ---- 출력 ----
const root = process.cwd()
mkdirSync(path.join(root, 'build'), { recursive: true })
mkdirSync(path.join(root, 'public'), { recursive: true })

const ico = encodeIco([256, 128, 64, 48, 32, 24, 16])
const png256 = encodePng(resampleToRGBA8(256), 256)

const icoPath = path.join(root, 'build', 'icon.ico')
const pngPath = path.join(root, 'build', 'icon.png')
writeFileSync(icoPath, ico)
writeFileSync(pngPath, png256)

// 창 아이콘(Electron) + 웹 favicon에 배포
writeFileSync(path.join(root, 'electron', 'icon.png'), png256)
writeFileSync(path.join(root, 'electron', 'icon.ico'), ico)
copyFileSync(icoPath, path.join(root, 'public', 'favicon.ico'))

console.log('✅ 아이콘 생성 완료:')
console.log('   build/icon.ico, build/icon.png')
console.log('   electron/icon.png, electron/icon.ico')
console.log('   public/favicon.ico')
