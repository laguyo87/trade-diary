/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Electron에서 file://로 로드되므로 상대 경로 사용
  base: './',
  plugins: [react()],
  server: {
    // 보유 종목 현재가 자동 조회용 프록시 (CORS 우회).
    // /naver-quote/{code} → 네이버 금융 실시간 시세 API
    proxy: {
      '/naver-quote': {
        target: 'https://polling.finance.naver.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/naver-quote/, '/api/realtime/domestic/stock'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
