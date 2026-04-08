# CharacterVerse

> 프로덕션급 AI 캐릭터 플랫폼

## 🚀 빠른 시작 (Windows)

### 1️⃣ 원클릭 개발 환경 시작

```powershell
.\dev.ps1
```

**이 명령어 하나로 모든 것이 자동으로 설정됩니다:**
- ✅ Docker 확인 및 실행
- ✅ PostgreSQL + Redis 시작
- ✅ 데이터베이스 스키마 생성
- ✅ 의존성 설치
- ✅ Prisma Client 생성

### 2️⃣ API 서버 실행

```powershell
cd apps\api
npm run dev
```

API 주소: `http://localhost:4000`

### 3️⃣ 웹 앱 실행

```powershell
cd apps\web
npm run dev
```

웹 주소: `http://localhost:3000`

---

## 📁 프로젝트 구조

```
characterverse/
├── apps/
│   ├── api/          # Fastify API 서버
│   ├── web/          # Next.js 웹 앱
│   └── mobile/       # React Native 앱
├── packages/         # 공유 패키지
├── infra/            # 인프라 설정
│   ├── docker/       # Dockerfile
│   ├── nginx/        # Nginx 설정
│   └── monitoring/   # Prometheus + Grafana
└── scripts/          # 유틸리티 스크립트
```

---

## 🛠️ 유용한 명령어

### 개발 환경 관리

```powershell
# 개발 환경 시작
.\dev.ps1

# 개발 환경 중지
.\dev.ps1 -Stop

# 개발 환경 완전 리셋 (데이터 삭제)
.\dev.ps1 -Reset
```

### 데이터베이스

```powershell
# Prisma Studio (DB GUI)
cd apps\api
npx prisma studio

# 데이터베이스 마이그레이션
npx prisma db push

# 스키마 동기화
npx prisma generate
```

### Docker 관리

```powershell
# 컨테이너 상태 확인
docker ps

# 로그 확인
docker logs cv_postgres_dev
docker logs cv_redis_dev

# 컨테이너 재시작
docker restart cv_postgres_dev
docker restart cv_redis_dev
```

---

## 🔌 서비스 주소

| 서비스 | 주소 | 설명 |
|--------|------|------|
| **API** | `http://localhost:4000` | Fastify REST API |
| **Web** | `http://localhost:3000` | Next.js 웹 앱 |
| **PostgreSQL** | `localhost:5432` | 데이터베이스 |
| **Redis** | `localhost:6379` | 캐시 |
| **Prisma Studio** | `http://localhost:5555` | DB 관리 GUI |

---

## 🔑 데이터베이스 접속 정보

**개발 환경 (로컬):**
- Database: `characterverse`
- User: `characterverse`
- Password: `password123`
- Host: `localhost`
- Port: `5432`

---

## 🏗️ 기술 스택

### Backend
- **Fastify** - 고성능 Node.js 웹 프레임워크
- **Prisma** - 타입 안전 ORM
- **PostgreSQL 16** - 주 데이터베이스
- **Redis 7** - 캐싱 및 세션

### Frontend
- **Next.js 14** - React 프레임워크
- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안전성

### Infrastructure
- **Docker** - 컨테이너화
- **Nginx** - 리버스 프록시
- **Prometheus** - 메트릭 수집
- **Grafana** - 모니터링 대시보드

---

## 📦 프로덕션 배포

### 전체 스택 배포 (Docker Compose)

```bash
# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 (프로덕션 키 입력)

# 프로덕션 빌드 및 시작
docker compose up -d
```

### 개별 서비스 배포

```bash
# API만 배포
docker compose up -d api

# Web만 배포
docker compose up -d web

# 인프라만 배포
docker compose up -d postgres redis
```

---

## 🔒 보안

- ✅ 모든 비밀번호는 암호학적으로 안전한 난수 생성
- ✅ JWT 토큰 기반 인증
- ✅ 환경 변수 분리 (.env는 .gitignore에 포함)
- ✅ SQL Injection 방지 (Prisma ORM)
- ✅ CORS 설정
- ✅ Rate Limiting

---

## 📝 환경 변수 생성

```powershell
# 보안 환경 변수 자동 생성
.\scripts\generate-env.ps1

# 프로덕션용 환경 변수
.\scripts\generate-env.ps1 -Production
```

생성 후 `.env` 파일을 열어서 다음을 설정하세요:
- `ANTHROPIC_API_KEY` - Claude AI API 키
- `AWS_ACCESS_KEY_ID` - AWS S3 키
- `GOOGLE_CLIENT_ID` - Google OAuth
- `KAKAO_CLIENT_ID` - Kakao OAuth

---

## 🐛 문제 해결

### Docker가 시작되지 않을 때

```powershell
# Docker Desktop 수동 실행
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 30초 대기 후 다시 시도
.\dev.ps1
```

### 데이터베이스 연결 실패

```powershell
# 컨테이너 재시작
docker restart cv_postgres_dev

# 로그 확인
docker logs cv_postgres_dev
```

### 포트 충돌 (이미 사용 중)

```powershell
# 포트 사용 프로세스 확인
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# 기존 프로세스 종료 또는 포트 변경
```

---

## 📚 추가 문서

- [API 문서](./apps/api/README.md)
- [Prisma 스키마](./apps/api/prisma/schema.prisma)
- [Docker 설정](./docker-compose.yml)
- [인프라 가이드](./infra/README.md)

---

## 🤝 기여

이 프로젝트는 프로덕션급 모범 사례를 따릅니다:
- TypeScript 엄격 모드
- ESLint + Prettier
- Husky Git Hooks
- Conventional Commits
- 자동화된 테스트

---

## 📄 라이선스

MIT License

---

## 🆘 지원

문제가 발생하면:
1. 이 README의 "문제 해결" 섹션 확인
2. Docker 로그 확인: `docker logs cv_postgres_dev`
3. 개발 환경 리셋: `.\dev.ps1 -Reset`

---

**Made with ❤️ for production-ready AI platforms**
