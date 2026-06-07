const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')

// 개발 모드면 Vite dev 서버 URL이 환경변수로 전달된다.
const DEV_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: '매매 일지',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true, // 기본 메뉴바 숨김 (Alt로 토글)
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (DEV_URL) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // 외부 링크(Pretendard 폰트 등)는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ---- 시세 조회 (CORS 없는 메인 프로세스에서 네이버 직접 호출) ----
ipcMain.handle('quotes:fetch', async (_event, codes) => {
  const list = Array.isArray(codes) ? codes.filter(Boolean) : []
  if (list.length === 0) return { datas: [] }
  const url =
    'https://polling.finance.naver.com/api/realtime/domestic/stock/' + list.join(',')
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
      Referer: 'https://finance.naver.com/',
    },
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return await res.json()
})

// ---- 시장지수 일별(종가) 조회 — 지수 대비 손절 기준용 ----
ipcMain.handle('index:fetch', async (_event, symbol, start, end) => {
  const url =
    'https://api.finance.naver.com/siseJson.naver?symbol=' +
    encodeURIComponent(symbol) +
    '&requestType=1&startTime=' +
    start +
    '&endTime=' +
    end +
    '&timeframe=day'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' },
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return await res.text()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
