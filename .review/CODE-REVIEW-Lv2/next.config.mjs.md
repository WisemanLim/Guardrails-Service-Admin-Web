# next.config.mjs — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](./INDEX.md)

## 파일 요약
- 역할: Next 설정. `output: 'standalone'`, `reactStrictMode`, env 인라인.
- 진입점 거리: N/A.
- LOC: 13
- export: default `nextConfig`
- 의존 모듈: 없음
- 외부 패키지: next (타입만)
- 부수효과: 없음 (선언)
- 동시성/렌더 경계: N/A
- 테스트 커버리지: 0

```js path=next.config.mjs lines=1-13
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Browser-side API calls go to the Admin API directly. The base URL must be
  // injected at build time because client bundles are static.
  env: {
    NEXT_PUBLIC_ADMIN_API_BASE_URL:
      process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:8084',
  },
};
export default nextConfig;
```

**분석 (Level 2)**
- L3 `output: 'standalone'`: Dockerfile 의 standalone 복사와 정합. 좋다.
- L4 `reactStrictMode: true`: 좋다. dev 모드 double-invoke 로 useEffect cancellation 누락 탐지에 도움.
- L7-10 `env` 블록: Next 의 `env` 는 빌드 타임에 `process.env.NEXT_PUBLIC_*` 을 client bundle 에 inline. **그러나 Next 14 는 `NEXT_PUBLIC_` prefix 자체가 자동 노출 기능을 제공**한다 — 이 `env` 블록은 사실상 fallback 을 박는 역할.
- L9 fallback `http://localhost:8084`: 이중 정의. lib/api.ts L8 이 같은 fallback 을 갖는다. 둘 중 하나만 두는 것이 명확:
  - 옵션 A: lib/api.ts 에서만 fallback (next.config 에서 env 블록 제거)
  - 옵션 B: next.config 에서만 fallback 강제 (lib/api.ts 가 process.env 만 신뢰)
- L9 fallback 의 값이 `localhost:8084` — **prod 빌드에서 ENV 누락 시 localhost 가 inline 됨**. 운영 배포 시 화면이 즉시 깨진다. CI 에서 build 직전 ENV 검사 권고.

**누락**
- **`async headers()` 미정의**: CSP / X-Frame-Options / Strict-Transport-Security / X-Content-Type-Options / Referrer-Policy / Permissions-Policy 헤더 미설정. admin 콘솔에 권고:
  ```js
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data:; connect-src 'self' <ADMIN_API>; script-src 'self'; style-src 'self' 'unsafe-inline'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }];
  }
  ```
- **`poweredByHeader: false`** 미설정 — `X-Powered-By: Next.js` 누설 (작은 정보).
- **`images.domains`/`remotePatterns`** 미정의 — `next/image` 미사용 (QR 은 data URL `<img>` 우회) 이라 영향 없음.
- **`experimental.serverActions`** 등 미설정 — 본 프로젝트는 server actions 미사용. OK.

**짚어볼 점 (frontend security)**
- CSP 부재 — XSS 가 발생하면 외부 도메인 callback / inline script 등을 막을 1차 방어선 없음.
- HSTS 부재 — http→https 강제 메커니즘 없음. 단 LB/CDN 단에서 처리하면 OK.
- X-Frame-Options 부재 — 클릭재킹 위험 (admin 콘솔에 특히 중요).

**파일 수준 평가**
- 강점
  1. standalone + strictMode.
  2. env 블록 + 주석.
- 위험
  1. CSP/HSTS/X-Frame-Options 등 보안 헤더 미설정.
  2. fallback `localhost:8084` 가 prod misconfig 위험.
  3. lib/api.ts 와 fallback 이중 정의.
- 개선 권고
  1. `async headers()` 도입 (위 예시).
  2. fallback 을 한 곳에만 두고 build 단계에서 ENV 누락 시 fail.
  3. `poweredByHeader: false`.
- 재읽기 권고 레벨: **HIGH** — 운영 배포 전 헤더 구성 필수.
