// 포터블 데스크톱 앱 빌더 (electron-builder 없이).
// node_modules의 Electron 런타임에 빌드된 웹앱(dist)과 electron/ 를 끼워넣어
// 더블클릭으로 실행되는 TradeDiary.exe 폴더를 만든다.
// → winCodeSign(맥 심볼릭 링크) 추출이 필요 없어 권한 문제 없이 동작.
import { cp, rm, mkdir, writeFile, rename, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const electronDist = path.join(root, 'node_modules', 'electron', 'dist')
const out = path.join(root, 'release', 'TradeDiary-win')
const appDir = path.join(out, 'resources', 'app')

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/ 가 없습니다. 먼저 `npm run build` 를 실행하세요.')
  process.exit(1)
}
if (!existsSync(electronDist)) {
  console.error('Electron이 설치되어 있지 않습니다. `npm install` 후 다시 시도하세요.')
  process.exit(1)
}

console.log('1/4  이전 산출물 정리…')
await rm(out, { recursive: true, force: true })
await mkdir(appDir, { recursive: true })

console.log('2/4  Electron 런타임 복사…')
await cp(electronDist, out, { recursive: true })

console.log('3/4  앱 파일(dist, electron) 복사…')
await cp(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true })
await cp(path.join(root, 'electron'), path.join(appDir, 'electron'), { recursive: true })

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    { name: pkg.name, version: pkg.version, productName: 'TradeDiary', main: 'electron/main.cjs' },
    null,
    2,
  ),
)

console.log('4/4  실행 파일 이름 변경 + 아이콘/정보 적용…')
const exe = path.join(out, 'electron.exe')
const target = path.join(out, 'TradeDiary.exe')
if (existsSync(exe)) await rename(exe, target)

// exe에 아이콘과 버전 정보 입히기 (rcedit, 관리자 권한 불필요)
const ico = path.join(root, 'build', 'icon.ico')
if (existsSync(ico)) {
  try {
    const { rcedit } = await import('rcedit')
    await rcedit(target, {
      icon: ico,
      'version-string': {
        ProductName: '매매일지',
        FileDescription: '매매 일지 — 한국 주식 매매 기록·분석',
        CompanyName: 'Trade Diary',
        LegalCopyright: '',
      },
      'file-version': pkg.version,
      'product-version': pkg.version,
    })
    console.log('     아이콘 적용 완료')
  } catch (e) {
    console.warn('     아이콘 적용 실패(무시 가능):', e.message)
  }
} else {
  console.warn('     build/icon.ico 없음 — `npm run icon` 후 다시 시도하세요.')
}

console.log('\n✅ 완료!  실행:  ' + target)
console.log('   폴더 전체(release\\TradeDiary-win)를 복사해 어디서든 더블클릭으로 실행할 수 있습니다.')
