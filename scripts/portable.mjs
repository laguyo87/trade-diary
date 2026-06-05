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

console.log('4/4  실행 파일 이름 변경…')
const exe = path.join(out, 'electron.exe')
const target = path.join(out, 'TradeDiary.exe')
if (existsSync(exe)) await rename(exe, target)

console.log('\n✅ 완료!  실행:  ' + target)
console.log('   폴더 전체(release\\TradeDiary-win)를 복사해 어디서든 더블클릭으로 실행할 수 있습니다.')
