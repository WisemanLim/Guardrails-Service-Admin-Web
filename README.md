# Guardrails-Service-Admin-Web

Next.js 14 (App Router) 기반 **Admin 관리 콘솔** 프론트엔드. `Guardrails-Service-Admin` REST API와 통신하여 사용자(고객사) 운영자가 가드레일 룰을 자가 관리할 수 있는 UI를 제공한다.

---

## 책임

1. 로그인 / 회원가입 (이메일·비밀번호 + TOTP QR 노출)
2. 대시보드 (총 룰 수, 도메인별 분포, 최근 로그인·감사 로그)
3. 룰 CRUD UI
   - 카테고리 / 도메인 / 로케일 / ioType 필터
   - 단건 추가·수정·삭제
   - 다건(체크박스) 벌크 삭제
   - CSV 업로드 (대량 import + rejected row 리포트)
4. 감사 로그 (로그인 히스토리 / 행위 감사) 탭
5. 사용자 관리 (super_admin only)
6. 설정 — TOTP 등록 (QR + 6자리 코드 검증) + 비밀번호 변경

---

## 스택

- Next.js 14 (App Router, server+client mixed)
- React 18, TypeScript 5.4
- 의존성 최소화 — Tailwind/UI 라이브러리 없이 단일 `globals.css`
- 인증: JWT localStorage (프로토타입). 운영 강화 시 httpOnly 쿠키 + BFF 프록시 권장.

---

## 디렉토리

```
app/
├── layout.tsx                  # root
├── globals.css                 # 단일 스타일시트
├── page.tsx                    # / → 로그인/대시보드 redirect
├── login/page.tsx              # 로그인 + TOTP
├── register/page.tsx           # 가입 + TOTP QR 노출
└── (app)/                      # 인증 필요 그룹
    ├── layout.tsx              # AuthGuard + Sidebar
    ├── dashboard/page.tsx
    ├── rules/
    │   ├── page.tsx            # 리스트 + 필터 + 벌크 삭제
    │   ├── new/page.tsx        # 단건 생성
    │   ├── [ruleId]/page.tsx   # 편집 + 삭제
    │   └── import/page.tsx     # CSV 업로드 + 거부 row 리포트
    ├── audit/page.tsx          # 로그인 / 행위 탭
    ├── users/page.tsx          # super_admin only
    └── settings/page.tsx       # TOTP enable + 비밀번호 변경
components/
├── AuthGuard.tsx
├── Sidebar.tsx
└── RuleForm.tsx
lib/
├── api.ts                      # fetch wrapper + 401 처리
├── auth.ts                     # localStorage helpers
└── types.ts
```

---

## 환경 변수

| 변수 | 기본 | 설명 |
| :-- | :-- | :-- |
| `PORT` | `3001` | dev/start 포트 |
| `NEXT_PUBLIC_ADMIN_API_BASE_URL` | `http://localhost:8084` | Admin API base URL. **브라우저 visible → build-time 주입.** |

---

## 로컬 dev

전제: Admin API가 `http://localhost:8084`에 떠 있어야 함. (`cd ../MCP-type-Guardrails-Service && make up-admin`)

```bash
cd Guardrails-Service-Admin-Web
npm install
cp .env.example .env.local       # 필요 시 BASE URL 변경
npm run dev                      # http://localhost:3001
```

---

## 빌드 / Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_ADMIN_API_BASE_URL=https://admin.guardrails.example.com \
  -t guardrails-admin-web .
docker run --rm -p 3001:3001 guardrails-admin-web
```

compose overlay:

```bash
# Main stack + Admin + Web
docker compose -f docker-compose.yml \
               -f docker-compose.privacy.yml \
               -f docker-compose.admin.yml \
               -f docker-compose.admin-web.yml up -d
```

---

## 화면 흐름

```
/
 └─ unauth → /login
 └─ auth   → /dashboard

/login        email + password [+ totp] → JWT
/register     email + password → TOTP QR 발급 → /login

(app)/
  /dashboard  KPI + 최근 로그인 + 최근 감사
  /rules      필터·페이지·체크박스 벌크 삭제·단건 삭제
  /rules/new
  /rules/:id  편집 + 삭제
  /rules/import   CSV 업로드 + 거부 row 표
  /audit      Tab: 로그인 히스토리 / 행위 감사
  /users      super_admin only
  /settings   계정 / TOTP enable / 비밀번호 변경
```

`401` 응답 시 자동 로그아웃 + `/login?reason=expired`로 redirect.

---

## API 매핑

| 화면 | 호출 |
| :-- | :-- |
| Login | `POST /admin/auth/login` |
| Register | `POST /admin/auth/register` |
| Dashboard | `GET /admin/auth/me` + `GET /admin/rules` + `GET /admin/audit/login-history` + `GET /admin/audit/actions` |
| Rules list | `GET /admin/rules?domain=...&locale=...&ioType=...&category=...` |
| Rule new | `POST /admin/rules` |
| Rule edit | `GET /admin/rules/:ruleId` + `PUT /admin/rules/:ruleId` + `DELETE /admin/rules/:ruleId` |
| Bulk delete | `DELETE /admin/rules` body `{ ruleIds: [] }` |
| CSV import | `POST /admin/rules/import-csv` (multipart) |
| Audit login | `GET /admin/audit/login-history` |
| Audit actions | `GET /admin/audit/actions` |
| Users | `GET /admin/users` (super_admin) |
| Settings TOTP | `GET /admin/auth/totp/qr` + `POST /admin/auth/totp/enable` |
| Settings password | `POST /admin/auth/password` |

---

## 향후 작업

- httpOnly 쿠키 + 서버 액션 기반 인증으로 마이그레이션
- Tailwind 정식 통합 + 디자인 토큰
- 룰 simulator (입력 → /policies/bundle 호출 + match preview)
- i18n (ko-KR / en) UI 분리
- 감사 로그 CSV 익스포트
- Bulk upsert UI (paste JSON / 다중 row 폼)
