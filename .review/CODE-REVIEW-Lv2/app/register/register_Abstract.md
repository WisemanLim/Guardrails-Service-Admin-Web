# app/register/ — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](../../INDEX.md)

## 디렉터리 역할
3-step 회원가입 wizard. (1) email+password → (2) TOTP enroll (QR + 6-digit) → (3) done.

## 파일 인덱스
| 파일 | LOC | 리뷰 |
|---|---:|---|
| `page.tsx` | 177 | [page.tsx.md](./page.tsx.md) |

## 관찰
- 등록 직후 TOTP gate OFF 인 점을 이용해 password-only login 후 enableTotp 호출.
- `<img src=dataUrl>` 로 QR — eslint 룰 비활성. `next/image` 가 data URL 미지원.
- skipTotp 가 존재 — 정책상 TOTP 강제 등록을 원하면 제거 또는 백엔드 차단.
- TOTP secret 평문 노출 (수동 입력용) — UX 의도된 단일 시점.

## 위험 핫스팟
- TOTP 강제화 정책 부재.
- enableTotp catch 의 비대칭 setLoading.
- autocomplete 누락 (`new-password`, `one-time-code`).
