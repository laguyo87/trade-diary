const { contextBridge, ipcRenderer } = require('electron')

// 렌더러(웹앱)에 안전하게 시세 조회 기능만 노출한다.
// window.quoteApi.fetch(codes) → 네이버 시세 JSON
contextBridge.exposeInMainWorld('quoteApi', {
  fetch: (codes) => ipcRenderer.invoke('quotes:fetch', codes),
})
