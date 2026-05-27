# lib/ — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 디렉터리 역할
공용 라이브러리. API 호출 래퍼, 세션 저장, 도메인 타입.

## 파일 인덱스
| 파일 | LOC | 리뷰 |
|---|---:|---|
| `api.ts` | 128 | [api.ts.md](./api.ts.md) |
| `auth.ts` | 41 | [auth.ts.md](./auth.ts.md) |
| `types.ts` | 87 | [types.ts.md](./types.ts.md) |

## 관찰
- `api.ts` 가 단일 fetch 허브 — in-degree 11. 401 자동 로그아웃, 모든 path param encode.
- `auth.ts` 가 localStorage 기반 세션 — XSS 한 발로 토큰 + role 전량 누출.
- `types.ts` 는 핵심 enum 을 union literal 로 좁힘. 단 `AuthedUser.status` 만 `string`, `Rule` 은 snake_case 인데 DTO 는 camelCase.
- `api.createRule`/`updateRule` 가 `any` — 타입 안전 0.
- `api.ts` 와 `auth.ts` 가 `'use client'` 디렉티브 → RSC/server-action 에서 import 불가.

## 위험 핫스팟 Top-3
1. JWT localStorage (auth.ts).
2. createRule/updateRule any (api.ts).
3. BASE URL fallback 이중 정의 (api.ts + next.config.mjs).

## 다음 단계
- RuleDto 타입 추가 후 any 제거.
- httpOnly 쿠키 모델로 마이그레이션 + middleware 도입.
- BASE 의 trailing slash 정규화 + ENV 누락 시 fail.
