# Root — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](./INDEX.md)

## 디렉터리 역할
프로젝트 루트. 빌드/설정 파일과 두 개의 큰 하위 (`app/`, `components/`, `lib/`) 를 묶는 진입점.

## 파일 인덱스 (이 디렉터리 직속)
| 파일 | LOC | 리뷰 | 메모 |
|---|---:|---|---|
| `Dockerfile` | 22 | [Dockerfile.md](./Dockerfile.md) | multi-stage, lockfile 부재, root 사용자 |
| `next.config.mjs` | 13 | [next.config.mjs.md](./next.config.mjs.md) | standalone, 보안 헤더 미설정 |
| `package.json` | 23 | [package.json.md](./package.json.md) | 의존성 3개, lockfile/eslint 부재 |
| `tsconfig.json` | 22 | [tsconfig.json.md](./tsconfig.json.md) | strict, paths @/* |
| `next-env.d.ts` | 2 | (생략, 자동 생성) | next reference only |

## 하위 디렉터리 인덱스
- [`app/`](./app/app_Abstract.md) — App Router 라우트
- [`components/`](./components/components_Abstract.md) — 공용 컴포넌트
- [`lib/`](./lib/lib_Abstract.md) — API/auth/types

## 디렉터리 수준 관찰
- **3개의 ENV 위험 경로**가 정렬되어 있음: `Dockerfile ARG` → `next.config.mjs env` → `lib/api.ts BASE`. 셋 모두 같은 fallback `http://localhost:8084` 를 가져 운영 misconfig 의 안전망이 아니라 **숨김 장치**. ENV 누락이 CI/CD 에서 명시적 fail 이 되어야 한다.
- **보안 헤더 부재**: next.config 의 `headers()` 미정의로 CSP/HSTS/X-Frame-Options 가 인프라 단(LB/CDN)으로 떠넘겨짐. admin 콘솔이라 X-Frame-Options=DENY 는 application 단에서 보장 권고.
- **lockfile + ESLint config + 테스트 도구 3가지 부재**: dev 인프라가 매우 빈약. supply-chain 표면은 좁지만 결정성이 약하다.
- **`.dockerignore`** (LOC 작음) 와 **`.env.example`** 은 본 리뷰에서 별도 파일로 다루지 않음 — 후자는 `PORT=3001` + `NEXT_PUBLIC_ADMIN_API_BASE_URL` 만 포함.

## 위험 핫스팟 (디렉터리 한정)
1. Dockerfile 의 `npm install` (lockfile 부재).
2. next.config 의 보안 헤더 부재.
3. ENV fallback 의 이중 정의.

## 다음 단계
- lockfile 도입 + Dockerfile `npm ci`.
- next.config 의 `async headers()` 도입.
- `.eslintrc.json` + `noUncheckedIndexedAccess` 등 tsconfig 보강.
