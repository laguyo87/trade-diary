/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 한국 증시 관습: 상승/이익 = 빨강, 하락/손실 = 파랑
        profit: '#e03131',
        loss: '#1971c2',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
