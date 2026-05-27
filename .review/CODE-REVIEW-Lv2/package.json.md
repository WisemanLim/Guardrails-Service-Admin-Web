# package.json — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](./INDEX.md)

## 파일 요약
- 역할: 패키지 메타. dev/start/build/lint script + 의존성.
- LOC: 23
- export: N/A
- 의존 모듈: next, react, react-dom (런타임 3개)
- 외부 패키지 (devDeps): typescript, @types/{node,react,react-dom}
- 부수효과: N/A
- 테스트 커버리지: 0 (jest/vitest/playwright 미정의)

```json path=package.json lines=1-23
{
  "name": "guardrails-admin-web",
  "version": "0.1.0",
  "description": "Admin Console (Next.js) for the MCP Guardrails Service. Talks to Guardrails-Service-Admin REST API.",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^14.2.5"... (실제: react ^18.3.1)
  }
}
```
(이하 실제 파일 내용 — 본 인용은 분석 컨텍스트만)

**분석 (Level 2)**
- `private: true`: npm publish 차단. OK.
- `version: 0.1.0`: 초기 단계.
- scripts:
  - `dev/start` 모두 port 3001 hardcode — Dockerfile ENV PORT=3001 와 일치.
  - `build`: standalone 산출 (next.config.mjs).
  - `lint: next lint` — **ESLint config 파일 부재** (`.eslintrc*` 가 트리에 없음). next-lint 가 첫 실행에서 config 생성을 묻거나 default 설정으로 동작. **사실상 lint 가 의미 있는 검사를 하지 않을 가능성** 높음.
- 런타임 의존성 3개: next/react/react-dom. supply-chain 표면 매우 좁음 — 좋다.
- devDependencies 4개: typescript + @types. 테스트 도구/포매터/eslint plugin 모두 부재.
- **lockfile 부재**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` 중 어느 것도 트리에 없음. Dockerfile 의 `npm install` 과 결합하여 비결정 빌드.
- **engines 미지정**: node 버전 강제 없음. Dockerfile 은 node:20-alpine 사용. `"engines": { "node": ">=20" }` 권고.
- **`type` 필드 미지정**: 기본 `commonjs`. next.config.mjs 가 `.mjs` 라 ESM — package 가 commonjs 라도 Next 가 처리. OK.

**짚어볼 점 (frontend security)**
- supply chain: 의존성 3개 — npm advisory 모니터링 단순.
- lockfile 부재 — minor/patch 업그레이드 시 silent 변경.
- lint 가 실효 없을 가능성 — react-hooks/exhaustive-deps, react/no-danger 등 보안 관련 규칙이 막히지 않음.

**파일 수준 평가**
- 강점
  1. 런타임 의존성 최소.
  2. private: true.
- 위험
  1. lockfile 부재.
  2. ESLint config 부재 — lint 가 noop.
  3. 테스트 도구 부재.
- 개선 권고
  1. `npm install` 한 번 → lockfile 커밋 + Dockerfile `npm ci`.
  2. `.eslintrc.json` 추가 (`extends: 'next/core-web-vitals'` + 보안 룰).
  3. `engines.node: ">=20"` 추가.
- 재읽기 권고 레벨: **MEDIUM** — lockfile + eslint 도입 시 재방문.
