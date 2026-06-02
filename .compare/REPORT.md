# 비교분석 REPORT: Guardrails-Service-Admin-Web

## 1. 개요 (기준 ref app → 적용대상, 2026-06-02)

- 기준(ref, 개선·최신): `DocuGuard-AI-Admin/apps/web/` (Next.js 14 Admin Web, 모노레포)
- 적용대상(current): `Guardrails-Service-Admin-Web/` (Next.js Admin Web, 독립 프로젝트)
- 매핑: ref `apps/web/` → current 루트
- 작업일: 2026-06-02
- QA 관점: API 클라이언트 해석 로직 개선만 포팅하고 current 네이밍("Guardrails-Service-*")은 보존. ref 브랜드 네이밍 미도입.

## 2. 구조 비교 (디렉토리/파일 차이)

`diff -rq`(node_modules/.next 제외) 결과 — **추가/삭제된 파일 없음**. 내용이 다른 파일만 3건:

| 파일 | 상태 | 성격 |
|------|------|------|
| `package.json` | 내용 차이 | 네이밍 전용 (name/description) |
| `lib/api.ts` | 내용 차이 | **기능 개선 (API base 해석)** |
| `Dockerfile` | 내용 차이 | **설정 개선 (build arg)** |

- `app/`, `components/`, `lib/`(api.ts 외), `public/`, `next.config.mjs`, `tsconfig.json`, `.env.example`, `README.md`: **동일**

## 3. 의존성 변경 (package.json diff)

- `dependencies` / `devDependencies` / `scripts`: **변경 없음 (완전 동일)**
- 차이는 메타데이터 2줄뿐:
  - `name`: current `guardrails-admin-web` ↔ ref `docuguard-ai-admin-web`
  - `description`: current "Admin Console (Next.js) for the MCP Guardrails Service…" ↔ ref "DocuGuard AI — Admin Console (Next.js 14)…"
- 신규 추가 의존성 없음.

## 4. 개선/추가/수정 항목 (설명 / ref 위치 / 영향도 / QA 리스크)

### [개선] API Base URL 런타임 해석 (`lib/api.ts`)
- 설명: 기존 `const BASE = env ?? 'http://localhost:8084'`(빌드 타임 고정)을 `resolveApiBase()`로 교체. 브라우저에서 `window.location`의 `<protocol>//<hostname>:<port>`로 동적 산출 → 동일 번들이 localhost/LAN IP/도메인에서 재빌드 없이 동작. 명시 env가 있으면 우선하되, **원격 호스트에서 서빙되는 번들에 localhost가 baked된 경우는 무시하고 page 호스트로 산출**(서버에서 `POST http://localhost:8084 ERR_CONNECTION_REFUSED` 원인 차단). SSR/비브라우저는 명시값 또는 localhost 폴백.
- ref 위치: `apps/web/lib/api.ts` (`isLocalHost`, `resolveApiBase`)
- 영향도: 높음. 원격 배포 API 연결성 직접 개선.
- QA 리스크: 포트가 `NEXT_PUBLIC_ADMIN_API_PORT`(기본 8084)에 의존. 리버스 프록시로 API가 동일 호스트/포트에 있으면 명시 env 핀 필요. hostname 기반 산출이라 멀티-호스트/프록시 토폴로지 검증 필요.

### [개선] Dockerfile build arg (`Dockerfile`)
- 설명: `NEXT_PUBLIC_ADMIN_API_BASE_URL` 기본값을 `http://localhost:8084` → **빈 값**으로 변경(런타임 산출 유도). `NEXT_PUBLIC_ADMIN_API_PORT=8084` build arg/env 신규 추가.
- ref 위치: `apps/web/Dockerfile` (builder 스테이지)
- 영향도: 중. 위 `lib/api.ts` 개선과 짝.
- QA 리스크: 빈 기본값이므로 build arg로 localhost를 핀하던 파이프라인은 동작 변화 가능 — 의도된 개선(IP-agnostic).

## 5. 적용 내역 (Applied) (파일별 변경 + 이유)

### `lib/api.ts`
- 단일 `const BASE = ...` 라인을 `isLocalHost()` + `resolveApiBase()` 헬퍼와 `const BASE = resolveApiBase()`로 교체(개선 주석 동반).
- 이유: 원격/LAN 배포 API 미연결(ERR_CONNECTION_REFUSED) 버그 픽스. 브랜드 호스트네임 미도입 — page 호스트 기반 동작이라 current 식별자와 무관.

### `Dockerfile`
- builder 스테이지 `NEXT_PUBLIC_ADMIN_API_BASE_URL` 기본값을 빈 값으로 변경, `NEXT_PUBLIC_ADMIN_API_PORT` arg/env 추가(개선 주석 동반).
- 이유: `lib/api.ts` 런타임 산출과 정합. 포트만 환경에서 핀 가능.

## 6. 미적용/보류 (Deferred) (이유)

- `package.json` `name`/`description`: current 네이밍("Guardrails-Service") 보존 정책에 따라 미적용. ref 브랜드 문구 미도입.
- 그 외 차이 없음.

## 7. 검증 결과 (build/typecheck)

- 빌드 명령: `npm run build` (`next build`)
- 결과: **성공 (exit 0)**. 전체 12개 라우트 컴파일/프리렌더 완료(`/login`, `/rules`, `/rules/[ruleId]`, `/audit`, `/users`, `/settings` 등) — 수정한 `lib/api.ts` 포함.
- `npm install`: 신규 의존성 없이 정상 설치 완료(네이티브 모듈 이슈 없음).

## 8. QA 체크리스트 & 회귀테스트 권고

- [ ] localhost 개발: 페이지가 `localhost`에서 서빙될 때 API base가 `http://localhost:8084`로 산출.
- [ ] LAN IP 배포: `http://<lan-ip>:3001` 접속 시 API가 `http://<lan-ip>:8084`로 산출되어 호출 성공.
- [ ] 도메인 배포: HTTPS 도메인에서 `https://<domain>:8084` 산출/호출 확인(프록시 시 env 핀 여부 점검).
- [ ] 명시 env 우선: `NEXT_PUBLIC_ADMIN_API_BASE_URL=https://api.example.com` 설정 시 그대로 사용.
- [ ] stale localhost 가드: 원격 호스트 서빙 + env에 `http://localhost:8084` baked → page 호스트로 산출(localhost 무시) 확인(핵심 회귀).
- [ ] malformed URL env: 파싱 실패 시 derived로 폴백.
- [ ] 포트 오버라이드: `NEXT_PUBLIC_ADMIN_API_PORT` 변경이 산출 URL에 반영.
- [ ] SSR/비브라우저 경로: 명시값 또는 localhost 폴백 동작.
- [ ] Docker 빌드: build arg 미지정 시 빈 base + 포트 8084로 이미지 정상 빌드/기동.
