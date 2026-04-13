# GCP Compute Engine 배포 가이드

## 포트 구성

| 서비스 | 포트 | 용도 |
|--------|------|------|
| backend | 8000 | FastAPI |
| student-web | 3000 | 학생 프론트엔드 (Nginx) |
| admin-web | 3001 | 관리자 프론트엔드 (Nginx) |

---

## 1단계 — GCP VM 인스턴스 생성

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 좌측 메뉴 → **Compute Engine** → **VM 인스턴스** → **인스턴스 만들기**
3. 아래 설정값 입력:

   | 항목 | 값 |
   |------|-----|
   | 이름 | `prompt-edu-server` (자유) |
   | 리전 | `asia-northeast3` (서울) |
   | 영역 | `asia-northeast3-a` |
   | 머신 계열 | E2 |
   | 머신 유형 | `e2-small` (최소) / `e2-medium` (권장) |
   | 부팅 디스크 OS | Ubuntu 22.04 LTS |
   | 부팅 디스크 크기 | 20GB 이상 |
   | 방화벽 | HTTP 트래픽 허용 ✅ |

4. **만들기** 클릭 후 외부 IP 메모

---

## 2단계 — 방화벽 규칙 추가 (포트 8000, 3000, 3001)

GCP는 보안그룹 대신 **VPC 방화벽 규칙**을 사용합니다.

```bash
# gcloud CLI 설치되어 있으면 로컬에서 실행, 아니면 콘솔 Cloud Shell에서 실행
gcloud compute firewall-rules create prompt-edu-ports \
  --allow tcp:8000,tcp:3000,tcp:3001 \
  --source-ranges 0.0.0.0/0 \
  --target-tags prompt-edu \
  --description "백엔드 8000, 학생 3000, 관리자 3001"
```

또는 **콘솔에서 직접 설정**:
- VPC 네트워크 → 방화벽 → 방화벽 규칙 만들기
- 트래픽 방향: 수신
- 대상: 네트워크의 모든 인스턴스
- 소스 IPv4 범위: `0.0.0.0/0`
- 프로토콜/포트: TCP `8000,3000,3001`

> **주의**: 방화벽 규칙을 만들어도 VM에 태그가 없으면 적용 안 될 수 있습니다.  
> 콘솔 방법을 쓸 경우 대상을 "네트워크의 모든 인스턴스"로 설정하면 태그 없이도 됩니다.

---

## 3단계 — VM 접속

**콘솔에서 바로 접속 (가장 간단)**:
- VM 인스턴스 목록에서 해당 VM의 **SSH** 버튼 클릭 → 브라우저 터미널 열림

**로컬에서 SSH 접속**:
```bash
# gcloud CLI 사용
gcloud compute ssh prompt-edu-server --zone asia-northeast3-a

# 또는 일반 SSH (GCP가 자동 생성한 키 사용)
ssh -i ~/.ssh/google_compute_engine [사용자명]@[외부IP]
```

---

## 4단계 — Docker 설치

```bash
# 패키지 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# Docker 공식 GPG 키 추가
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Docker 저장소 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker + Compose 플러그인 설치
sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# 현재 유저를 docker 그룹에 추가 (sudo 없이 사용)
sudo usermod -aG docker $USER

# 재로그인 (그룹 적용)
exit
# 다시 SSH 접속
```

설치 확인:
```bash
docker --version
docker compose version
```

---

## 5단계 — 프로젝트 업로드

### 옵션 A: git clone (권장)
```bash
git clone <your-repo-url> /home/[사용자명]/prompt_edu
cd /home/[사용자명]/prompt_edu
```

### 옵션 B: gcloud scp로 직접 업로드
```bash
# 로컬 PC에서 실행
gcloud compute scp --recurse \
  --exclude="node_modules,__pycache__,.venv,*.db,dist" \
  /path/to/prompt_edu_eval_student_prj \
  prompt-edu-server:/home/[사용자명]/prompt_edu \
  --zone asia-northeast3-a
```

### 옵션 C: rsync (일반 SSH 키 방식)
```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.db' \
  --exclude='dist' \
  /path/to/prompt_edu_eval_student_prj/ \
  [사용자명]@[외부IP]:/home/[사용자명]/prompt_edu/
```

---

## 6단계 — 환경변수 설정

```bash
cd /home/[사용자명]/prompt_edu

cp .env.example .env
nano .env
```

`.env` 내용:
```env
SERVER_IP=<VM 외부 IP>       # 예: 34.64.xx.xx
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
SECRET_KEY=<아래 명령어로 생성>
```

SECRET_KEY 생성:
```bash
openssl rand -hex 32
# 출력된 값을 .env의 SECRET_KEY에 붙여넣기
```

---

## 7단계 — 빌드 및 실행

```bash
cd /home/[사용자명]/prompt_edu

# 이미지 빌드 + 컨테이너 시작 (백그라운드)
docker compose up -d --build

# 전체 로그 확인
docker compose logs -f

# 서비스별 로그 확인
docker compose logs -f backend
docker compose logs -f student-web
docker compose logs -f admin-web
```

---

## 8단계 — 시드 데이터 삽입 (최초 1회)

```bash
docker compose exec backend python seed.py --reset
```

---

## 접속 확인

| 서비스 | URL |
|--------|-----|
| 학생 프론트엔드 | `http://<외부IP>:3000` |
| 관리자 프론트엔드 | `http://<외부IP>:3001` |
| 백엔드 API 문서 | `http://<외부IP>:8000/docs` |

---

## 자주 쓰는 운영 명령어

```bash
# 전체 재시작
docker compose restart

# 코드 변경 후 재빌드
docker compose up -d --build

# 컨테이너 상태 확인
docker compose ps

# 백엔드 컨테이너 셸 접속
docker compose exec backend bash

# 전체 중지 (DB 볼륨 유지)
docker compose down

# 전체 중지 + DB 볼륨 삭제 (초기화)
docker compose down -v
```

---

## VM 중지/재시작 시 주의사항

GCP는 VM을 **중지했다가 다시 시작하면 외부 IP가 바뀝니다**.  
IP가 바뀌면 `.env`의 `SERVER_IP`를 수정하고 재배포해야 합니다.

**고정 IP 설정 (권장)**:
- VPC 네트워크 → 외부 IP 주소 → **고정 주소 예약**
- VM에 해당 고정 IP 연결
- 월 약 $3 정도 추가 비용 발생

---

## 주의사항

- `.env` 파일은 절대 git에 커밋하지 말 것 (`.gitignore`에 추가)
- `SECRET_KEY`는 반드시 `openssl rand -hex 32`로 생성한 값 사용
- SQLite DB는 `db_data` Docker 볼륨에 저장 — `docker compose down -v` 시 삭제됨
- 트래픽이 많아지면 SQLite → Cloud SQL(PostgreSQL) 마이그레이션 고려
