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

## 로그인 (Google, 이메일)

`.env.local`에 Supabase 값이 있으면 진짜 로그인으로 동작하고, 없으면 이 기기에만 저장되는 데모 로그인으로 동작합니다.

Supabase 대시보드에서 한 번만 설정합니다.

1. **Authentication → URL Configuration**: Site URL에 앱 주소(개발 중에는 `http://localhost:5173`), Redirect URLs에 `http://localhost:5173/**`를 넣습니다. 배포하면 배포 주소도 추가합니다.
2. **Authentication → Sign In / Providers → Email**: 켜져 있는지 확인하고, 최소 비밀번호 길이를 8로 맞춥니다. 개발 중에는 **Confirm email**을 꺼 두면 확인 메일 없이 바로 가입됩니다(무료 플랜은 메일 발송 한도가 작습니다). 배포 전에는 다시 켭니다.
3. **Authentication → Sign In / Providers → Google**: Google Cloud에서 만든 OAuth 클라이언트 ID와 보안 비밀번호를 붙여넣고 켭니다. Google 쪽 승인된 리디렉션 URI는 `https://<프로젝트ID>.supabase.co/auth/v1/callback` 입니다.

Google 보안 비밀번호는 Supabase 화면에만 넣고, 저장소나 `.env`에는 넣지 않습니다.

## 서버 저장, 닉네임, 회원 탈퇴

로그인(진짜 계정)하면 운동, 식단, 루틴, 설정이 서버에 자동으로 저장되고, 다른 기기에서 로그인해도 이어집니다. 닉네임은 서버에서 중복을 막고, 회원 탈퇴는 가입한 이메일을 입력해야 서버가 계정과 데이터를 모두 지웁니다.

서버 표와 규칙은 SQL 한 번으로 만듭니다.

1. Supabase 대시보드 → **SQL Editor** → New query
2. `supabase/migrations/20261031000000_user_data.sql` 파일 내용을 붙여넣고 **Run**
   (CLI를 쓴다면 `supabase db push`)

만들어지는 것:

| 이름 | 역할 |
|---|---|
| `user_data` 표 | 사용자별 앱 데이터. 본인만 읽고 쓸 수 있음(행 단위 보안) |
| `profiles` 표 | 닉네임. 대소문자 구분 없이 중복 불가 |
| `nickname_available()` | 닉네임을 쓸 수 있는지 true/false만 알려 줌 |
| `delete_my_account(email)` | 이메일이 맞을 때만 내 계정과 데이터를 삭제 |

동작 규칙:
- 로그인할 때 서버에 내 데이터가 있으면 서버 것을 쓰고, 없으면 이 기기의 데이터를 올립니다. 이 기기가 같은 계정의 데이터를 갖고 더 새로 바뀐 경우에만 이 기기 것을 올립니다.
- 식단 **사진**은 용량 때문에 서버에 올리지 않고 이 기기에만 남습니다.
- 로그아웃하면 저장이 확인된 뒤 이 기기의 데이터를 지웁니다(공용 기기 보호). 저장에 실패하면 데이터를 지우지 않습니다.
- 커뮤니티 글은 아래 "커뮤니티" 항목을 보세요.
- SQL을 적용하기 전에는 설정 화면의 "서버 저장"에 준비가 안 됐다고 나오고, 앱은 이 기기에만 저장하며 정상 동작합니다.

## 커뮤니티 (채팅처럼 이어지고, 매달 새로 시작)

로그인한 사용자의 커뮤니티 글은 서버에 저장되어 모두가 같은 대화를 봅니다.

- 한 달 동안 글이 유지되고, 다른 사람이 쓰면 바로(실시간) 나타납니다.
- **매달 1일(한국 시간)** 이 되면 지난달 글은 보이지 않고, 다음 글이 올라오는 순간 서버에서 지워집니다.
- 닉네임과 작성자는 서버가 정해서 위조할 수 없고, 1분에 10개까지만 올릴 수 있습니다(도배 방지).
- 신고는 사람마다 한 번만 세고, 3회 이상이면 숨겨집니다. 내 글만 지울 수 있습니다.

서버 설정: `supabase/migrations/20261031000100_comments.sql` 을 **user_data 파일 다음에** SQL Editor 에서 실행합니다.
(실시간 알림에는 Supabase 대시보드 > Database > Replication 에서 `comments` 표가 켜져 있어야 하며, 이 SQL 이 켜 줍니다.)
로그인하지 않은 데모 상태에서는 이 기기에만 저장되고 매달 초기화되지 않습니다.

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

투데이 화면 아래에 개발자의 하루 볼륨과 내 기록의 비교가 나옵니다. 개발자 계정으로 운동을 기록하면 모든 사용자의 화면에 자동으로 반영됩니다.

서버 로그인(Supabase)을 쓸 때:
1. `supabase/migrations/20261031000200_developer_volume.sql` 을 SQL Editor 에서 실행합니다 (앞의 두 SQL 다음에).
2. 개발자 본인 이메일로 앱에 가입합니다.
3. SQL Editor 에서 아래를 이메일만 바꿔서 한 번 실행해 그 계정을 개발자 계정으로 지정합니다.
   ```sql
   insert into public.developer_accounts (user_id)
   select id from auth.users where email = '내_이메일@example.com';
   ```
4. 그 계정으로 운동을 기록하면 기록이 바뀔 때마다 `developer_volume` 표에 자동 저장됩니다. 다른 사용자는 읽기만 가능하고, 개발자 계정이 아니면 서버가 저장을 거절합니다.

개발자 계정은 이메일이 아니라 **가입한 뒤 소유자가 SQL로 직접 지정**합니다(확인 메일을 끈 상태에서 남이 같은 이메일로 먼저 가입해 개발자 행세를 하지 못하게 하기 위해서입니다).
해제: `delete from public.developer_accounts where user_id = (select id from auth.users where email = '...');`

데모 모드(`.env.local` 없음)에서는 설정의 **개발자 모드** 스위치를 켜면 개발 서버(`npm run dev`)가 `public/developer-volume.json` 에 저장합니다(같은 컴퓨터에서 온 요청만 받음). 읽기/쓰기 코드는 `src/lib/developerVolume.ts` 에 모여 있습니다.

## 번역

화면 문구는 한국어 원문을 `tr('...')`로 감싸고, 영어는 `src/lib/en.ts`에 둡니다. 새 문구를 추가하면 `en.ts`에도 영어를 추가하세요. 번역이 없으면 한국어 그대로 보입니다.

## CI

`main`에 올리거나 풀 리퀘스트를 열면 GitHub Actions(`.github/workflows/ci.yml`)가 웹앱 빌드와 테스트, Flutter 분석과 테스트를 실행합니다. 비밀값은 쓰지 않습니다.

## 라이선스

독점(모든 권리 보유)입니다. 코드는 보고 참고하는 것만 허용되고, 저작권자의 허락 없이 사용, 복사, 수정, 배포, 판매할 수 없습니다. 자세한 내용은 [LICENSE](LICENSE)를 보세요. 다른 곳에서 가져온 그림과 오픈소스 라이브러리는 각자의 라이선스를 따릅니다.
