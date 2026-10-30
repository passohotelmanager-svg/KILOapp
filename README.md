# KILO

헬스 기록 앱. 세트 기록, 휴식 타이머, 볼륨 분석, 식단 기록, 커뮤니티를 한곳에서 관리합니다.

## 구성

| 폴더 | 내용 |
|---|---|
| `src/` | 웹앱 (React + TypeScript + Vite). 한국어와 영어를 지원합니다. |
| `kilo_app/` | Flutter 앱. 지금은 AI 운동 분석 화면만 있는 초기 단계입니다. |
| `supabase/` | 서버 쪽. Edge Function(`analyze-workout`, `recommend-workout`)과 DB 마이그레이션 |
| `public/` | 정적 파일. 개발자의 볼륨 예시(`developer-volume.json`) 포함 |

## 웹앱 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

- 데이터는 브라우저 `localStorage`에 저장됩니다 (`src/store.ts`). 서버 연동 시 이 파일의 저장/불러오기만 바꾸면 됩니다.
- 로그인은 데모용 가짜 계정입니다. 실제 로그인(Google, Apple, Facebook, 이메일)은 서버 연동 단계에서 붙입니다.

### 명령어

| 명령 | 설명 |
|---|---|
| `npm run build` | 타입 검사와 빌드 |
| `npm test` | 웹앱 단위 테스트 (vitest) |
| `npm run test:functions` | 서버 함수 테스트 (Node 내장 테스트, Node 22.18 이상) |
| `npm run seed -- <PRD 경로>` | 종목 시드(`src/data/exercises.json`) 다시 만들기 |

## 환경 변수

`.env.example`을 `.env.local`로 복사해서 값을 채웁니다. **`.env.local`은 git에 올라가지 않습니다.**

| 변수 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 주소 (공개 값) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase 공개용(publishable) 키 (공개 값) |

없어도 앱은 돌아갑니다. 이 값이 없으면 AI 추천은 기록 기반 규칙 추천으로 대신 동작합니다.

### 절대 올리면 안 되는 것

다음은 저장소에 넣지 않습니다. `.gitignore`에 이미 제외돼 있습니다.

- `.env`, `.env.*` (`.env.example`만 예외)
- `kilo_app/supabase.json` (예시는 `kilo_app/supabase.example.json`)
- Supabase **secret / service_role 키**
- `GEMINI_API_KEY`: 앱이 아니라 Supabase Edge Function 비밀값으로만 등록합니다.
  ```bash
  supabase secrets set GEMINI_API_KEY=...
  ```
- `supabase/.temp/` (연결된 프로젝트 ID가 들어 있음)
- `*.pem`, `*.p12`, `*.jks`, `*.keystore`, `*service-account*.json`

실수로 키를 올렸다면 지우는 것으로는 부족합니다. 기록에 남기 때문에 **해당 키를 즉시 폐기하고 새로 발급**하세요.

## Flutter 앱

```bash
cd kilo_app
cp supabase.example.json supabase.json   # 값을 채운다 (git에 올라가지 않음)
flutter pub get
flutter run --dart-define-from-file=supabase.json
flutter analyze && flutter test
```

## 서버 (Supabase)

```bash
supabase link --project-ref <프로젝트ID>
supabase db push                                   # 마이그레이션 적용
supabase secrets set GEMINI_API_KEY=...            # Gemini 키 (서버에만 보관)
supabase functions deploy analyze-workout
supabase functions deploy recommend-workout
```

- 두 함수 모두 로그인한 사용자만 쓸 수 있고(익명 불가), 사용자당 하루 10회로 제한됩니다.
- 함수는 운동 기록의 요약(부위별 볼륨 등)만 받으며, 이메일이나 이름 같은 개인정보는 걸러냅니다.

## 개발자의 볼륨

투데이 화면 아래에 개발자의 하루 볼륨과 내 기록의 비교가 나옵니다.

- 설정에서 **개발자 모드**를 켜면 내 운동 기록이 바뀔 때마다 개발자 볼륨이 갱신됩니다.
- 지금은 개발 서버(`npm run dev`)가 `public/developer-volume.json`에 저장하는 임시 방식입니다. 같은 컴퓨터(localhost)에서 온 요청만 받습니다.
- 배포할 때는 서버 DB로 바꾸고, 개발자 여부를 스위치가 아니라 계정으로 가려야 합니다. 읽기/쓰기 코드는 `src/lib/developerVolume.ts`에 모여 있습니다.

## 번역

화면 문구는 한국어 원문을 `tr('...')`로 감싸고, 영어는 `src/lib/en.ts`에 둡니다. 새 문구를 추가하면 `en.ts`에도 영어를 추가하세요. 번역이 없으면 한국어 그대로 보입니다.

## CI

`main`에 올리거나 풀 리퀘스트를 열면 GitHub Actions(`.github/workflows/ci.yml`)가 웹앱 빌드와 테스트, Flutter 분석과 테스트를 실행합니다. 비밀값은 쓰지 않습니다.

## 라이선스

독점(모든 권리 보유)입니다. 코드는 보고 참고하는 것만 허용되고, 저작권자의 허락 없이 사용, 복사, 수정, 배포, 판매할 수 없습니다. 자세한 내용은 [LICENSE](LICENSE)를 보세요. 다른 곳에서 가져온 그림과 오픈소스 라이브러리는 각자의 라이선스를 따릅니다.
