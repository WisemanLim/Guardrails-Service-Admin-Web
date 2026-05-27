# tsconfig.json — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](./INDEX.md)

## 파일 요약
- 역할: TypeScript 컴파일 설정.
- LOC: 22
- export: N/A
- 부수효과: N/A
- 테스트 커버리지: 0

```json path=tsconfig.json lines=1-22
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**분석 (Level 2)**
- `target: ES2022`: 좋다. Node 20 + 최신 브라우저.
- `lib: ['dom', 'dom.iterable', 'esnext']`: DOM 타입 포함 — client-heavy 프로젝트 적합. SSR/RSC 영역에서 `window` 접근이 잘못해도 컴파일러가 못 잡아낸다.
- `allowJs: false`: 좋다.
- `skipLibCheck: true`: node_modules 의 .d.ts 체크 생략 — 빌드 속도. OK.
- `strict: true`: **핵심**. noImplicitAny, strictNullChecks 등 활성. **그러나 `api.ts` 가 `rule: any` 를 명시적으로 사용** — strict 가 explicit any 는 막지 못함. `noExplicitAny` 룰은 ESLint 영역.
- `noEmit: true`: next 가 빌드. OK.
- `esModuleInterop`, `module: esnext`, `moduleResolution: 'bundler'`: Next 14 권장.
- `isolatedModules: true`: 각 파일이 독립 transpile 가능 — `import type` 사용 가능.
- `jsx: preserve`: Next 가 처리.
- `incremental: true`: `.tsconfig.tsbuildinfo` 생성 — 빠른 재빌드. .gitignore 에 포함 여부 확인 필요.
- `plugins: [{ name: 'next' }]`: Next 의 TS plugin.
- `paths: { '@/*': ['./*'] }`: root 부터의 절대 import — 잘 쓰이고 있음.
- `include`: next-env.d.ts + 모든 ts/tsx + .next/types — 표준.
- `exclude`: node_modules 만 — `.next` 빌드 산출도 자동 exclude 됨 (next 가 처리).

**누락 옵션 (권고)**
- `noUncheckedIndexedAccess: true`: array/object index 접근 시 `T | undefined`. 안전성 ↑.
- `noFallthroughCasesInSwitch: true`: switch fallthrough 방지 (현재 switch 미사용이지만 안전망).
- `forceConsistentCasingInFileNames: true`: 대소문자 OS 차이 보호.
- `exactOptionalPropertyTypes: true`: optional `?:` 와 `| undefined` 구분 강화.

**짚어볼 점 (frontend security)**
- `strict: true` 는 좋지만 `any` 폭탄을 막지 못함 — ESLint `@typescript-eslint/no-explicit-any` 권고.
- `lib: ['dom', ...]` — server-only 코드에서 `document` 등 접근 시 컴파일러가 막지 않음. 본 프로젝트는 클라이언트 위주라 영향 적음.

**파일 수준 평가**
- 강점: strict + ES2022 + moduleResolution=bundler 의 modern 조합.
- 위험
  1. any 폭탄 (`api.ts`) 을 못 잡음 — ESLint 필요.
  2. noUncheckedIndexedAccess 등 보강 옵션 미적용.
- 개선 권고
  1. `noUncheckedIndexedAccess: true` 추가.
  2. `.eslintrc.json` 도입 + `@typescript-eslint/no-explicit-any: error`.
- 재읽기 권고 레벨: **LOW**.
