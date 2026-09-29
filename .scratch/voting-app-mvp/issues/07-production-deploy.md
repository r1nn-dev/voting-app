# 07: 운영 배포 (Vercel + Neon main)

**What to build:** 앱이 Vercel 운영 URL에서 Neon `main` 브랜치를 사용해 동작한다. 관리자와 투표자가 실제 URL에서 만들기 → 투표 → 마감 → 결과 → 삭제 흐름을 끝까지 쓸 수 있다. Vercel과 Neon 콘솔에서 사람이 직접 해야 하는 단계가 중심이다. 코드 쪽에서 필요한 조정이 생기면 이 티켓에서 함께 처리한다. 스펙: `.scratch/voting-app-mvp/spec.md`.

**Blocked by:** 05, 06

**Status:** ready-for-human

- [ ] Neon에 `main`(운영), `dev`(로컬), `test`(테스트) 브랜치가 있고, 각 브랜치에 `db:migrate`로 최신 스키마가 적용돼 있다.
- [ ] Vercel 프로젝트가 GitHub 저장소 `r1nn-dev/voting-app`의 `main` 브랜치와 연결돼 있다.
- [ ] Vercel Production 환경변수를 설정했다.
  - `DATABASE_URL`: Neon `main` 브랜치의 pooled 연결 문자열
  - `ADMIN_PASSWORD`: 충분히 긴 무작위 값
  - `SESSION_SECRET`: 32바이트 이상 무작위 값
- [ ] 운영 배포가 성공하고, 운영 URL에서 스모크 테스트를 통과한다.
  - 로그인이 동작하고, 틀린 비밀번호는 거부된다.
  - 투표를 만들고, 시크릿 창을 포함한 두 브라우저로 투표한다.
  - 마감 전에는 수치가 보이지 않는다.
  - 마감하면 결과가 공개되고, 이후 투표는 거부된다.
  - 삭제하면 목록에서 사라지고 공유 링크는 404가 된다.
- [ ] README의 배포 절차가 실제 수행한 절차와 일치한다.
