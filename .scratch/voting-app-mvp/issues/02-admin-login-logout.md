# 02: 운영자 로그인/로그아웃

**What to build:** 운영자가 `/admin/login`에서 환경변수 비밀번호 하나로 로그인하면 `/admin`에 들어갈 수 있고, 로그인 상태가 7일간 유지된다. 로그아웃하면 다시 로그인해야 한다. 로그인하지 않은 채 관리 경로에 들어가면 로그인 페이지로 보내진다. `/admin`은 아직 로그아웃 버튼만 있는 껍데기 화면이다. 스펙: `.scratch/voting-app-mvp/spec.md`. 결정 배경: ADR-0004.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 운영자 인증 모듈은 DB와 쿠키 입출력에 의존하지 않고, 다음 세 가지를 제공한다.
  - `verifyAdminPassword`: 타이밍 공격에 안전한 비교, 실패 시 약 1초 지연
  - `createAdminSession`: `jose` 서명, 키는 `SESSION_SECRET`, 7일 만료
  - `verifyAdminSession`
- [ ] 인증 모듈 단위 테스트가 통과한다.
  - 비밀번호: 맞는 비밀번호, 틀린 비밀번호, 길이가 다른 입력
  - 세션: 새 세션 검증 성공, 만료된 토큰 거부, 변조된 토큰 거부, 다른 키로 서명된 토큰 거부
  - 실패 지연은 주입하거나 가짜 타이머로 처리해서 테스트가 느려지지 않는다.
- [ ] `/admin/login` 폼은 틀린 비밀번호면 한국어 오류를 보여주고, 맞으면 httpOnly 세션 쿠키를 설정한 뒤 `/admin`으로 이동한다. 폼 상태는 `useActionState`로 관리한다.
- [ ] 로그인한 상태로 `/admin/login`에 오면 `/admin`으로 이동한다.
- [ ] `/admin`에 로그아웃 버튼이 있고, 누르면 세션 쿠키가 지워지고 로그인 페이지로 이동한다.
- [ ] `proxy`(Next 16 규칙. `middleware` 아님)는 세션이 없거나 유효하지 않으면 관리 경로에서 `/admin/login`으로 리다이렉트한다. 로그인 페이지 자체는 예외다.
- [ ] 관리 페이지는 proxy에만 의존하지 않고, 서버에서 직접 세션을 검증한다. 운영자 Server Action이 첫 줄에서 세션을 검증할 수 있도록 공용 헬퍼를 둔다.
- [ ] `ADMIN_PASSWORD`나 `SESSION_SECRET`이 없으면 명확한 오류로 실패한다.
