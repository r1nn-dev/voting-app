# 운영자는 환경변수 비밀번호 하나와 서명 쿠키 세션으로 인증한다

운영자는 한 명(또는 비밀번호를 공유하는 한 역할)이다. 그래서 계정 테이블 없이, Vercel 환경변수 `ADMIN_PASSWORD` 하나로 로그인한다. 로그인에 성공하면 `jose`로 서명한 httpOnly 쿠키(7일, 서명 키는 `SESSION_SECRET`)를 발급하고, DB 세션 테이블은 두지 않는다. 비밀번호는 `timingSafeEqual`로 비교하고, 실패하면 약 1초 지연한다. IP별 시도 제한은 추가 저장소가 필요해 두지 않았다. NextAuth/Auth.js는 비밀번호 하나짜리 로그인에는 과하다고 판단했다.

## Consequences

- 권한 확인은 모든 운영자 Server Action 안에서 직접 한다. Next 16에서 Server Action은 누구나 호출할 수 있는 공개 POST 엔드포인트이기 때문이다. `proxy.ts`는 `/admin` 접근 시 로그인 페이지로 보내는 편의 기능일 뿐, 보안 경계가 아니다.
- 세션을 서버에서 개별로 끊을 수 없다. 모든 운영자 세션을 무효화하려면 `SESSION_SECRET`을 바꾼다.
