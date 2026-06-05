# 📈 매매 일지 (Trade Diary)

한국 주식 거래를 기록·분석하고, 매매마다 복기 메모를 남겨 꾸준히 쌓아가는 **개인용 단일 사용자 로컬 웹앱**입니다.
모든 데이터는 서버 없이 브라우저의 `localStorage`에만 저장됩니다.

## 기술 스택

- Vite + React + TypeScript
- Tailwind CSS
- recharts (차트)
- Vitest (단위 테스트)

## 실행 방법 (웹)

```bash
npm install      # 의존성 설치 (최초 1회)
npm run dev      # 개발 서버 실행 → http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
npm test         # 단위 테스트 실행 (파서 · 라운드트립 매칭)
```

## 데스크톱 앱 (Electron)

더블클릭으로 실행되는 독립 창 앱입니다. 데스크톱 앱에서는 시세 조회를 메인
프로세스가 네이버에 직접 요청하므로 **자동 시세 조회·장중 자동 갱신이 그대로 동작**합니다
(웹과 달리 개발 서버 프록시가 필요 없음).

```bash
npm run app:dev       # 개발용: Vite + Electron 동시 실행 (코드 수정 즉시 반영)
npm run app:portable  # ★ 권장: release/TradeDiary-win/TradeDiary.exe 생성 (설치 불필요)
npm run app:install   # 빌드 → C:\Program Files\TradeDiary 설치 + 바탕화면 바로가기 (UAC 승인 필요)
npm run app:build     # 배포용 NSIS 설치 파일 생성 → release/TradeDiary Setup x.y.z.exe
```

### C:\Program Files에 설치/업데이트 (`app:install`)
빌드 후 `C:\Program Files\TradeDiary`로 복사하고 바탕화면에 "매매일지" 바로가기를 만듭니다.
Program Files 쓰기에는 관리자 권한이 필요하므로 **실행 중 뜨는 UAC 창에서 "예"** 를 눌러야 합니다.
(권한 작업은 별도 ASCII 스크립트 `scripts/copy-to-programfiles.ps1`로 분리해 승격하고, 한글 바로가기는
`scripts/install.ps1`이 비승격 상태에서 생성합니다.) 코드 수정 후 다시 `npm run app:install` 하면 설치본이 갱신됩니다.

### 권장: 포터블 빌드 (`app:portable`)
`release\TradeDiary-win\` 폴더가 만들어지고 그 안의 **`TradeDiary.exe`** 를 더블클릭하면 바로 실행됩니다.
폴더 전체를 USB나 다른 PC로 복사해도 그대로 동작합니다(설치 과정 없음). electron-builder가 필요 없어
**별도 권한 없이** 빌드됩니다.

### 설치 파일 (`app:build`, 선택)
NSIS 설치본(시작메뉴/바탕화면 바로가기 생성)을 만들려면 `app:build` 를 쓰는데,
electron-builder가 내려받는 `winCodeSign` 패키지에 **macOS 심볼릭 링크**가 들어 있어
Windows에서 추출하려면 **심볼릭 링크 생성 권한**이 필요합니다. 둘 중 하나로 해결하세요.
- **Windows 개발자 모드 켜기**: 설정 → 개인 정보 및 보안 → 개발자용 → "개발자 모드" ON (재부팅 불필요), 또는
- **관리자 권한 터미널**에서 `npm run app:build` 실행.

> 권한을 바꾸기 번거로우면 `app:portable` 만으로 충분합니다(기능 동일).

### 공통
- 데이터는 앱별 로컬 저장소에 보관됩니다. 웹 버전에서 쓰던 데이터는 [가져오기] 탭에서
  **JSON 백업 → 데스크톱 앱에서 JSON 복원**으로 그대로 옮길 수 있습니다.
- 앱 아이콘을 바꾸려면 `.ico` 파일을 준비해 `build.win.icon`(설치본) 또는 포터블 빌드 후
  `TradeDiary.exe` 아이콘을 교체하세요(미지정 시 기본 Electron 아이콘).

## 모바일 앱 (PWA · 안드로이드/아이폰)

이 앱은 **설치형 PWA**라 폰 홈 화면에 앱처럼 설치할 수 있습니다(오프라인 동작, 별도 빌드 도구 불필요).
설치(서비스워커)에는 **HTTPS**가 필요하므로 정적 호스팅에 올린 뒤 폰에서 여는 방식이 가장 쉽습니다.

### 1) 배포된 주소에서 설치 (이미 설정됨 · 권장)
**라이브 주소: https://laguyo87.github.io/trade-diary/** (GitHub Pages, HTTPS)

폰 크롬에서 위 주소 접속 → 메뉴 **⋮ → 앱 설치 / 홈 화면에 추가** → 캔들 아이콘으로 설치됩니다.

코드를 고친 뒤 다시 배포하려면:
```bash
npm run deploy     # 빌드 후 gh-pages 브랜치로 게시 (1~2분 뒤 위 주소에 반영)
```
- GitHub Pages 소스 = `gh-pages` 브랜치(루트). 소스 코드는 `main` 브랜치.
- 저장소: https://github.com/laguyo87/trade-diary (Public, 소스만 — 거래 데이터·카톡 원본은 `.gitignore` 제외)
- `base: './'` 라 서브경로(`/trade-diary/`)에서도 그대로 동작합니다.

> 다른 호스팅을 쓰려면 `npm run build` 후 `dist/`를 Netlify Drop(https://app.netlify.com/drop)
> 등에 올려도 됩니다.

### 2) 같은 와이파이에서 빠르게 테스트 (설치는 제한)
```bash
npm run preview:lan   # 터미널에 표시되는 Network 주소(http://192.168.x.x:4173)를 폰에서 열기
```
- 브라우저로 바로 사용은 되지만, **평문 http라 "설치(PWA)"는 안 됩니다**(보안 컨텍스트 필요). 설치까지 하려면 1)의 HTTPS 방식을 쓰세요.

### 참고
- 데이터는 **기기마다 따로** 저장됩니다(localStorage). PC ↔ 폰 이전은 [가져오기] 탭의 **JSON 백업/복원**으로 합니다.
- 자동 시세 조회는 브라우저 CORS 때문에 PWA에선 동작하지 않습니다 → 보유 종목 **현재가 수동 입력**으로 사용하세요(데스크톱 앱은 자동 동작).

## 주요 기능

### 1. 매매 기록
- **수동 입력**: 날짜/시간, 종목명, 종목코드, 매매구분(매수/매도), 수량, 단가. 거래금액 자동 계산.
- **카카오톡 체결안내 자동 파싱**: 한국투자증권 카카오톡 알림 텍스트를 통째로 붙여넣으면 체결 건만 골라 여러 건을 한 번에 인식합니다. 체결안내가 아닌 메시지는 무시합니다.

### 2. 라운드트립 매칭
같은 종목(·계좌)의 매수/매도를 **FIFO**로 짝지어 실현손익·수익률(%)을 자동 계산합니다. 미청산(보유) 수량은 대시보드에 별도 표시됩니다.

### 3. 복기 일지
라운드트립(매도 청산)마다 전략 태그(갭앤고/불플래그/ABCD/모멘텀 + 직접 추가), 진입 이유, 청산 이유, 감정/심리, 배운 점, 자기평가 별점(1~5)을 남길 수 있습니다.

### 4. 대시보드
총 실현손익, 승률, 손익비(평균수익÷평균손실), 프로핏 팩터, 평가손익(보유), 총 손익(실현+평가) 지표.
**총자산 / 손익 추이**, 종목별·전략별 손익 그래프 제공.
차트(recharts)는 별도 청크로 **지연 로딩(lazy-load)** 되어 대시보드 탭을 열 때만 내려받습니다(초기 번들 경량화).

#### 총자산 추이 그래프
청산일별 **누적 실현손익**을 선으로 그리고, 마지막에 보유 종목의 **평가손익을 더한 "현재" 점**을 점선으로 이어 총손익을 보여줍니다.
대시보드의 **초기 투자원금(예수금)** 을 입력하면 그래프가 **총자산(절대값)** 기준으로 전환됩니다(미입력 시 누적 손익 기준).
※ 과거 시점의 보유 평가액은 당시 시세 데이터가 없어 추정하지 않으며, 평가손익은 항상 "현재가" 기준으로 가장 마지막 점에만 반영됩니다.

### 4-1. 보유 종목 현재가 연동 (평가손익)
미청산(보유) 포지션의 **현재가**를 반영해 평가금액·평가손익·평가수익률을 계산합니다.
- **자동 조회**: "전체 현재가 불러오기" 버튼으로 네이버 금융 실시간 시세를 가져옵니다.
  보유 종목은 **멀티-코드 엔드포인트로 1회 요청에 묶어** 가져옵니다.
  - 데스크톱 앱(Electron): 메인 프로세스가 직접 호출 → **항상 동작**.
  - 웹: CORS 우회를 위해 Vite 개발 서버 프록시(`/naver-quote/{codes}`)를 사용하므로 **`npm run dev` 환경에서만** 자동 조회가 동작합니다.
- **장중 자동 갱신**: "장중 자동 갱신"을 켜면 한국 정규장(평일 09:00~15:30 KST) 동안 선택한 주기(10초/30초/1분/5분)로 현재가를 자동 갱신합니다. 장 마감·주말에는 호출하지 않으며, 장 시작 시 자동 재개됩니다. (휴장일은 별도 캘린더가 없어 미반영 — 휴장일엔 시세가 그대로라 갱신해도 무방)
- **수동 입력**: `npm run preview`·정적 배포·오프라인 등 프록시가 없는 환경에서는 현재가 칸에 직접 입력하면 됩니다(입력값도 localStorage에 저장).

### 5. 필터/검색
기간·종목·매매구분·전략별 필터.

### 6. 데이터 영속성 · 백업
- `localStorage` 자동 저장 (새로고침해도 유지).
- **JSON 전체 백업/복원**, **CSV 내보내기/가져오기**로 백업 및 기기 이전 지원.

## 카카오톡 체결안내 형식

아래와 같은 형식을 인식합니다 (여러 건을 한 번에 붙여넣어도 됩니다):

```
2025년 10월 24일 오전 10:41, 한국투자증권 : [한국투자증권 체결안내]10:41
*계좌번호:64****22-29
*계좌명:김신회
*매매구분:현금매수체결
*종목명:KODEX 200미국채혼합(284430)
*체결수량:212주
*체결단가:16,325원
```

파싱 규칙:
- 매매구분에 "매수"→매수, "매도"→매도
- 종목명 `이름(코드)` → 이름 + 6자리 코드 분리
- 수량/단가는 숫자만 추출(콤마·"주"·"원" 제거)
- "오전/오후 HH:MM" 12시간제 → 24시간제 변환
- 계좌번호는 선택 필드로 저장(계좌별 매칭·필터용)
- 동일 체결 중복 붙여넣기는 자동으로 1건만 저장

파서는 `src/lib/kakaoParser.ts`에 분리되어 있으며, `src/lib/kakaoParser.test.ts`에 위 샘플을 포함한 단위 테스트가 있습니다.

## 폴더 구조

```
src/
  types.ts                # 데이터 모델
  lib/
    kakaoParser.ts        # 카카오톡 체결안내 파서 (+ .test.ts)
    roundtrip.ts          # FIFO 라운드트립 매칭 (+ .test.ts)
    stats.ts              # 대시보드 지표 계산
    filters.ts            # 기간/종목/구분/전략 필터
    storage.ts            # localStorage · CSV/JSON 입출력
    format.ts             # 원화/퍼센트/색상 포맷
  hooks/useStore.ts       # 상태 + 영속화 + 파생 데이터
  components/             # Dashboard / TradeList / Journal / ImportPanel ...
```

## ⚠️ 개인정보 주의

카카오톡 원본 대화 파일과 거래 데이터에는 **계좌번호·계좌명 등 개인정보**가 포함됩니다.
`.gitignore`에 `data/`, `*.kakao.txt`, `exports/`, `*카카오톡 대화*` 가 등록되어 있어 깃에 올라가지 않습니다.
원본 대화 파일은 저장소 바깥(예: `data/`)에 두거나 위 패턴에 맞춰 보관하세요.

## 데이터 모델

```ts
trade: { id, datetime, stockName, stockCode, side, quantity, price, amount, account?, fee? }
roundTrip: { id, stockCode, stockName, openDate, closeDate, quantity, avgBuyPrice, sellPrice, pnl, pnlPct, ... }
journalEntry: { roundTripId, strategy[], entryReason, exitReason, emotion, lesson, rating }
```
