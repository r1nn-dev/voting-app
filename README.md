# 투표 앱

관리자가 질문과 선택지로 투표를 만들고, 익명 투표자가 선택지 하나에 표를 던지는 웹앱입니다. 결과는 관리자가 투표를 마감한 뒤에만 공개됩니다. 용어는 [CONTEXT.md](CONTEXT.md), 주요 결정은 [docs/adr/](docs/adr/)에 있습니다.

기술 스택은 Next.js 16 (App Router), Neon Postgres (`@neondatabase/serverless`, ORM 없음), Vercel입니다.

## 환경변수

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | 앱이 쓰는 DB. 로컬은 Neon `dev` 브랜치, 운영은 `main` 브랜치 |
| `TEST_DATABASE_URL` | 통합 테스트용 DB. **테스트마다 모든 테이블을 비웁니다.** |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호. 충분히 길고 무작위인 값으로 설정합니다. |
| `SESSION_SECRET` | 관리자 세션 쿠키 서명 키 (32바이트 이상 무작위 값). 바꾸면 모든 관리자 세션이 끊깁니다. |

로컬에서는 `.env.local`에 넣습니다. 필수 값이 없으면 그 값을 쓰는 시점에 어떤 변수가 빠졌는지 알려주는 오류가 납니다.

무작위 값은 이렇게 만들 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Neon 브랜치

| 브랜치 | 용도 | 연결 |
|---|---|---|
| `main` | 운영 | Vercel Production의 `DATABASE_URL` |
| `dev` | 로컬 개발 | `.env.local`의 `DATABASE_URL` |
| `test` | 통합 테스트 | `.env.local`의 `TEST_DATABASE_URL` |

`test` 브랜치를 따로 두지 않고 `TEST_DATABASE_URL`에 `dev` 브랜치를 지정해도 됩니다. 다만 그러면 테스트를 돌릴 때마다 로컬 데이터가 지워집니다.

## 마이그레이션

`db/migrations/`의 번호 붙은 SQL 파일 중 아직 적용되지 않은 것만 순서대로 적용합니다. 적용 기록은 `schema_migrations` 테이블에 남기고, 여러 번 실행해도 안전합니다. 한 번 적용한 파일은 고치지 말고, 새 번호로 파일을 추가하세요.

```bash
npm run db:migrate            # DATABASE_URL에 적용
npm run db:migrate -- --test  # TEST_DATABASE_URL에 적용
```

운영 DB에 적용할 때는 대상 URL을 직접 지정합니다.

```bash
DATABASE_URL="<main 브랜치 연결 문자열>" node scripts/migrate.mts
```

## 개발

```bash
npm install
npm run db:migrate
npm run db:seed    # 빈 DB에 예시 투표 6개 (진행 중 3, 마감 2, 보관 1)
npm run dev        # http://localhost:3000, 헤더의 "관리자" → /admin
```

`npm run db:seed -- --reset`은 기존 투표를 모두 지우고 예시를 다시 넣습니다. `TEST_DATABASE_URL`이 dev 브랜치와 같다면 `npm test`가 끝날 때 DB가 비므로, 테스트 뒤에는 시드를 다시 넣어야 합니다.

## 테스트

```bash
npm test           # Vitest
npm run typecheck
npm run lint
```

테스트 범위:
- **투표 모듈 (`lib/polls.ts`):** `TEST_DATABASE_URL`의 실제 DB로 통합 테스트합니다. 시작할 때 마이그레이션을 적용하고, 테스트마다 테이블을 비우며, 파일을 순차 실행합니다.
- **관리자 인증 모듈 (`lib/admin-auth.ts`):** DB 없이 단위 테스트합니다.

Server Action, 페이지, `proxy.ts`는 자동 테스트하지 않습니다. 그래서 관리자 Server Action을 추가하거나 고칠 때는 첫 줄에서 `requireAdmin()`을 부르는지 리뷰에서 확인하세요 (ADR-0004).

## 배포 (Vercel)

1. Neon `main` 브랜치에 마이그레이션을 적용합니다 (위 명령).
2. Vercel 프로젝트를 GitHub 저장소와 연결합니다.
3. Vercel Production 환경변수에 `DATABASE_URL`(main 브랜치의 pooled 연결 문자열), `ADMIN_PASSWORD`, `SESSION_SECRET`을 설정합니다.
4. 배포한 뒤 운영 URL에서 이 흐름을 확인합니다: 로그인 → 투표 만들기 → 두 브라우저로 투표 → 마감 → 결과 → 삭제.
