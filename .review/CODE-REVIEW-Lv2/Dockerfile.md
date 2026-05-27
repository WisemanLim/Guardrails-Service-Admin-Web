# Dockerfile — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](./INDEX.md)

## 파일 요약
- 역할: multi-stage 이미지 빌드 (deps → builder → runtime). `output: 'standalone'` 활용.
- 진입점 거리: N/A (인프라).
- LOC: 22
- export: N/A
- 의존 모듈: package.json
- 외부 패키지: node:20-alpine
- 부수효과: 빌드 시 `npm install`, `npm run build`. 런타임 `node server.js`.
- 동시성/렌더 경계: N/A
- 테스트 커버리지: 0

```dockerfile path=Dockerfile lines=1-22
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-fund --no-audit

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_ADMIN_API_BASE_URL=http://localhost:8084
ENV NEXT_PUBLIC_ADMIN_API_BASE_URL=$NEXT_PUBLIC_ADMIN_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
```

**분석 (Level 2)**
- L1 `FROM node:20-alpine AS deps`: alpine 사용 — musl libc. `node-gyp` 빌드 필요 시 alpine + python/g++ 필요하나 본 프로젝트는 native dep 없음 (next/react만) — OK.
- L3 `COPY package.json ./` — **lockfile 부재**. `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` 어느 것도 복사하지 않음. INDEX.md 2.4 에서 지적.
- L4 `npm install --no-fund --no-audit`: **`npm ci` 가 아닌 `install`**. 비결정적 빌드. 매번 minor/patch 업그레이드 위험. **변경 권고**: lockfile 추가 + `npm ci`.
- L8 `ARG NEXT_PUBLIC_ADMIN_API_BASE_URL=http://localhost:8084`: build-arg 기본값. README/운영 가이드에 `--build-arg` 로 prod URL 주입한다고 적혀 있겠지만, 미주입 시 fallback `localhost:8084` 가 client bundle 에 박힘 → prod 가 즉시 손상. CI/CD 에서 `--build-arg` 누락 가드 필요.
- L9 `ENV NEXT_PUBLIC_ADMIN_API_BASE_URL=$NEXT_PUBLIC_ADMIN_API_BASE_URL`: ARG → ENV 승격. next build 가 ENV 를 읽어 inline.
- L10 `COPY --from=deps /app/node_modules ./node_modules`: deps stage 의 node_modules 재사용 — 캐시 효율 좋음.
- L11 `COPY . .`: **`.dockerignore` 의존**. README/`.review` 등 무관 파일 포함 가능. `.dockerignore` 가 적절히 설정되었는지 별도 검토 필요.
- L12 `RUN npm run build`: next build → `.next/standalone` + `.next/static` 산출.
- L15 `FROM node:20-alpine AS runtime`: **별도 stage** — 좋다. dev deps 가 final 이미지에 없음 (standalone 이 필요 파일만 복사).
- L16-17 ENV NODE_ENV=production, PORT=3001.
- L18 `COPY --from=builder /app/.next/standalone ./`: standalone server.js + 최소 node_modules.
- L19 `COPY --from=builder /app/.next/static ./.next/static`: 정적 자산.
- L20 `COPY --from=builder /app/public ./public`: 공개 자산 (현재 빈 디렉터리 + .gitkeep).
- L21 `EXPOSE 3001`: 문서화 hint.
- L22 `CMD ["node", "server.js"]`: standalone 모드의 진입점.

**누락**
- **`USER` 미설정**: 컨테이너가 root 로 실행. node:20-alpine 은 기본 root. `USER node` 또는 `USER 1001` 권고 (defense-in-depth).
- **HEALTHCHECK 미설정**: 런타임이 살아있는지 docker level 에서 확인 불가. 컨텍스트 노트에 따르면 외부에서 `/login` ping. `HEALTHCHECK CMD wget -qO- http://localhost:3001/login || exit 1` 권고.
- **builder 의 dev dependencies**: `npm install` 은 dev deps 도 설치. final 이미지에는 빠지지만 builder 가 dev deps 까지 들고 가는 것은 비효율 + 공격면. `npm ci && npm prune --production` 또는 별도 build deps 분리.
- **lockfile**: 위에서 지적.
- **`COPY package.json ./` 만** — `npm install` 이 동작하지만 일관성 부재.

**짚어볼 점 (frontend security)**
- root 사용자 — 컨테이너 escape 시 영향 확대.
- 빌드 시점 ENV inline — runtime 변경 불가. dev/staging/prod 별 이미지 분리 필요.
- ARG 의 fallback `localhost:8084` 가 prod 빌드에 박힐 위험.

**파일 수준 평가**
- 강점
  1. multi-stage + standalone — 이미지 크기 최소화.
  2. ARG → ENV 패턴 표준.
  3. NODE_ENV=production 명시.
- 위험
  1. `npm install` (lockfile 부재) → 비결정 빌드.
  2. root 사용자 + HEALTHCHECK 부재.
  3. ARG fallback localhost — prod misconfig 위험.
- 개선 권고
  1. lockfile 추가 + `npm ci`.
  2. `USER node` + `HEALTHCHECK`.
  3. CI 에서 prod build 시 `NEXT_PUBLIC_ADMIN_API_BASE_URL` 누락을 build fail 로 처리.
- 재읽기 권고 레벨: **HIGH** — 운영 배포 직전 변경 권고 사항이 다수.
