# Soongsil Developers Follower Auto-Invite

GitHub Organization [`@Soongsil-Developers`](https://github.com/Soongsil-Developers)을 팔로우하는 유저 중 **프로필의 Company가 숭실대학교(`Soongsil`, `Soogsil`, `SSU`, `ssu`, `숭실` 등)로 설정된 유저를 감지하여 조직 멤버로 자동 초대**하는 GitHub Action 및 자동화 스크립트입니다.

---

## 주요 기능

1. **팔로워 프로필 자동 감지**:
   - `https://github.com/Soongsil-Developers`의 팔로워 목록을 페이지네이션하여 조회합니다.
   - 각 팔로워의 프로필 Company 필드를 검사합니다.

2. **유연한 숭실대 소속 검증 (오타 및 축약어 대응)**:
   - `Soongsil` 키워드 포함 (예: `Soongsil University`, `Soongsil Univ.`, `Soongsil Univ`, `Soongsil CSE` 등)
   - 오타 대응 `Soogsil` 키워드 포함
   - `SSU`, `ssu` 축약어 대응 (`issue`, `tissue` 등 일반 단어 오탐 방지를 위한 단어 경계 검증 적용)
   - 한국어 표기 `숭실대학교`, `숭실대` 지원

3. **중복 초대 방지**:
   - 이미 조직의 활성 멤버(`active members`)인 사용자는 자동으로 제외합니다.
   - 이미 초대가 발송되어 대기 중(`pending invitations`)인 사용자도 사전에 필터링하여 불필요한 중복 API 호출을 방지합니다.

4. **GitHub Actions 주기적 실행 및 수동 실행**:
   - 매일 자정 UTC (한국 시간 오전 9시) Cron 스케줄로 자동 실행됩니다.
   - `workflow_dispatch`를 지원하여 GitHub 웹 콘솔에서 언제든 수동 실행할 수 있습니다.
   - `dry_run` 옵션을 통해 실제로 초대장을 보내지 않고 대상 유저를 먼저 확인할 수 있습니다.

---

## 필수 설정 (GitHub Secrets)

GitHub Actions의 기본 `GITHUB_TOKEN`은 리포지토리 스코프만 제공하므로, Organization 멤버를 초대하려면 **`admin:org` 권한을 가진 Personal Access Token (PAT)**이 필요합니다.

### 1. Personal Access Token 발급
1. GitHub 우측 상단 프로필 클릭 -> **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)** 이동
2. **Generate new token (classic)** 클릭
3. Token 이름 입력 (예: `soongsil-auto-invite-token`)
4. Scopes에서 **`admin:org`** (필수: Organization 멤버 초대 및 조회 권한) 선택
5. 토큰 발급 후 값 복사

### 2. 리포지토리 Secret 등록
1. 이 리포지토리의 **Settings** -> **Secrets and variables** -> **Actions** 이동
2. **New repository secret** 클릭
3. Name: `ORG_ADMIN_TOKEN`
4. Secret: 위에서 복사한 PAT 입력 후 저장

---

## 로컬 실행 및 테스트 방법

### 1. 의존성 설치
```bash
pnpm install
```

### 2. 단위 테스트 실행 (Vitest)
```bash
pnpm test
```

### 3. 로컬 Dry-Run 실행
```bash
cp .env.example .env
# .env 파일에 ORG_ADMIN_TOKEN 입력
pnpm start
```

---

## 디렉토리 구조

```
├── .github/
│   └── workflows/
│       └── invite-followers.yml   # GitHub Actions 워크플로 정의 (Cron + 수동 실행)
├── src/
│   ├── index.ts                   # 실행 진입점 및 환경변수 설정
│   ├── invite.ts                  # GitHub API 연동 및 초대 오케스트레이션 서비스
│   ├── matcher.ts                 # Company 필드 정규화 및 매칭 검증 모듈
│   └── types.ts                   # TypeScript 인터페이스 정의
├── tests/
│   ├── invite.test.ts             # 초대 프로세스 및 중복 방지 Mock 테스트
│   └── matcher.test.ts            # 소속 매칭 및 축약어/오타 단위 테스트
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vitest.config.ts
```
