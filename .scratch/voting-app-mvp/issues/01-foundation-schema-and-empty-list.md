# 01: 기반: 스키마, 마이그레이션 러너, 테스트 하네스, 빈 메인 목록

**What to build:** 개발자가 명령 하나로 Neon `dev`/`test` 브랜치에 초기 스키마를 적용할 수 있게 한다. 방문자가 메인 페이지(`/`)에 들어오면, DB에서 읽은 투표 목록을 보게 한다. 지금은 투표가 없으므로 "투표 없음" 안내가 보인다. 이후 모든 티켓이 올라탈 투표 모듈, DB 접근, 통합 테스트 하네스의 뼈대를 이 티켓에서 만든다. 스펙: `.scratch/voting-app-mvp/spec.md`. 결정 배경: ADR-0003, ADR-0005.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 번호가 붙은 SQL 마이그레이션 파일과 러너 스크립트(`db:migrate`)가 있다. 러너는 대상 URL에 미적용 파일만 순서대로 적용하고, 적용 기록을 `schema_migrations`에 남긴다. 두 번 실행해도 안전하다.
- [ ] 초기 마이그레이션이 `polls`, `options`, `votes`를 만든다. 스펙의 스키마(랜덤 텍스트 ID, `closed_at`, `position`, 유니크 제약, `(poll_id, voter_id)` PK, `(poll_id, option_id)` 복합 FK, `ON DELETE CASCADE`, `created_at` 인덱스)와 일치해야 한다.
- [ ] 투표 모듈이 DB 핸들을 인자로 받는 형태로 존재하고, `listPolls()`가 최신순 목록을 반환한다. 모듈은 Next API나 쿠키에 의존하지 않는다.
- [ ] DB 접근은 `@neondatabase/serverless`의 `sql` 태그 템플릿으로만 하고, 값은 항상 파라미터로 넘긴다.
- [ ] `/`가 요청마다 DB를 읽어 목록을 렌더링하고, 비어 있으면 한국어로 "투표 없음" 안내를 보여준다.
- [ ] Vitest를 설치하고 `test` npm 스크립트를 추가한다. 통합 테스트는 다음 조건으로 돈다.
  - 대상: `TEST_DATABASE_URL`
  - 시작 전 마이그레이션 적용, 각 테스트 전 `TRUNCATE`
  - 순차 실행
- [ ] `listPolls`에 대한 통합 테스트가 한 개 이상 통과한다: 빈 목록, 최신순 정렬.
- [ ] 필수 환경변수가 없으면 사용하는 시점에 어떤 변수가 빠졌는지 알려주는 오류로 실패한다.
- [ ] README에 다음을 적는다: 환경변수 목록(`DATABASE_URL`, `TEST_DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`), Neon 브랜치 구성(`main`=운영, `dev`=로컬, `test`=테스트), 마이그레이션 방법, 테스트 실행 방법.
- [ ] `npm run build`와 `npm run lint`가 통과한다.
