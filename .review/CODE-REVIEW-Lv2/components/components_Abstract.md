# components/ — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 디렉터리 역할
공용 클라이언트 컴포넌트. 인증 게이트, 사이드바, 룰 폼.

## 파일 인덱스
| 파일 | LOC | 리뷰 |
|---|---:|---|
| `AuthGuard.tsx` | 23 | [AuthGuard.tsx.md](./AuthGuard.tsx.md) |
| `RuleForm.tsx` | 205 | [RuleForm.tsx.md](./RuleForm.tsx.md) |
| `Sidebar.tsx` | 48 | [Sidebar.tsx.md](./Sidebar.tsx.md) |

## 관찰
- 모두 `'use client'`. localStorage 의존이라 RSC 화 불가.
- AuthGuard 는 ready 게이트로 보호 자식 마운트 차단 — 좋다.
- Sidebar 의 role 필터는 cosmetic.
- RuleForm 은 가장 큰 파일 (205 LOC) 이지만 600 LOC 임계 미달.

## 위험 핫스팟
- AuthGuard 가 클라이언트 측만 (서버 경계 0).
- RuleForm 의 `safeJson` silent fallback.
- Sidebar 의 `pathname.startsWith` prefix 충돌 가능성.
