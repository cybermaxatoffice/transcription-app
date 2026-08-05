# 📝 필사 서비스 프로젝트 구축 & 트러블슈팅 종합 가이드 (QnA.md)

본 문서는 필사 서비스 개발 과정에서 진행된 초기 개발 환경 구축, 핵심 라이브러리 간의 연관 관계 설정, 문제 발생 상황(Issue) 및 해결 방법(Troubleshooting)을 정리한 기술 문서입니다.

---

## 📌 1. 프로젝트 초기 환경 설정 및 라이브러리 연관 구조

### 1.1 기술 스택 (Tech Stack)
* **Framework**: Next.js (App Router, React 19)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **PDF Parsing**: `pdfjs-dist` (PDF 문서 텍스트 파싱)
* **Version Control**: Git & GitHub Desktop

### 1.2 프로젝트 디렉토리 구조
```text
transcription-app-github/              <- 최상위 Git 리포지토리
└── transcription-app/                 <- Next.js 프로젝트 실제 루트 (실행 위치)
    ├── app/
    │   └── page.tsx                   <- 메인 필사 서비스 소스 코드
    ├── public/
    │   └── data/                      <- 정적 PDF 파일 배치 디렉토리
    ├── package.json                   <- 의존성 패키지 관리
    ├── next.config.ts                 <- Next.js 빌드 및 웹팩 설정
    └── QnA.md                         <- 본 기술 및 트러블슈팅 종합 문서
```

### 1.3 라이브러리 간 연관성 및 설치 방법

1. **`pdfjs-dist` (v3 버전 고정)**
   * **역할**: 사용자가 `public/data`에 배치한 PDF 파일을 읽어 문장 단위로 분할 및 파싱.
   * **연관성 주의사항**: Next.js SSR 및 Node.js 환경에서는 v4 이상 최신 버전 사용 시 Canvas 호환 에러가 발생하므로 반드시 **v3 버전(3.11.174)**을 사용해야 합니다.
   * **설치 명령어**:
     ```bash
     npm uninstall pdfjs-dist
     npm install pdfjs-dist@3.11.174 --save
     ```

2. **PDF Worker CDN 연관 설정**
   * **역할**: 백그라운드 스레드에서 PDF를 파싱하는 스크립트.
   * `app/page.tsx` 최상단에 Worker 경로 지정 필수:
     ```typescript
     import * as pdfjsLib from 'pdfjs-dist';
     pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
     ```

3. **Next.js 번들러 외부화 설정 (`next.config.ts`)**
   ```typescript
   import type { NextConfig } from "next";

   const nextConfig: NextConfig = {
     serverExternalPackages: ["pdfjs-dist"],
   };

   export default nextConfig;
   ```

---

## 🛠️ 2. 트러블슈팅 및 Q&A (Troubleshooting)

### Q1. VS Code에서 라이브러리를 설치했는데 GitHub Desktop Changes에 안 나타납니다.
* **원인**: `package.json` 변경 사항이 자동 반영/커밋되어 `History` 탭으로 넘어갔거나 미저장 상태인 경우.
* **해결**: `package.json`에 `"pdfjs-dist": "3.11.174"` 저장 확인 후 GitHub Desktop의 `History` 탭을 점검하거나 `Push origin` 진행.

### Q2. `Warning: Please use the 'legacy' build in Node.js environments` 빌드 에러
* **원인**: `pdfjs-dist` 최신 v4 버전과 Next.js SSR Canvas 모듈 충돌.
* **해결**: `pdfjs-dist@3.11.174` 버전 고정 설치 및 `next.config.ts`에 `serverExternalPackages` 옵션 지정.

### Q3. 회사 망 보안 이슈로 브라우저 파일 업로드 차단
* **원인**: 보안 정책상 `<input type="file" />` 및 네트워크 파일 전송 차단.
* **해결**: `public/data/` 폴더에 PDF를 미리 배치 후 `fetch('/data/sample1.pdf')` 형태로 서버 로컬 경로 파싱 우회.

### Q4. `public/data` 내 PDF가 Git 미감지 또는 중복 확장자 발생
* **원인**: 빈 폴더 Git 추적 제외, 윈도우 확장자 숨김으로 인한 `sample1.pdf.pdf` 중복 문제.
* **해결**: `transcription-app/public/data/` 디렉터리에 `.gitkeep` 추가 및 파일명을 `sample1.pdf`로 정상화.

### Q5. 오타 수정 시 오타율 미반영 및 이전 문장 이동 시 순서 꼬임
* **원인**: 오타율 계산 시 최신 `input` 미참조, 인덱스 전환 비동기 타이밍 이슈.
* **해결**: `calculateStats()`에서 작성 중인 `input` 우선 반영 및 `currentIndex` 변경 시 캐시 동기화 전용 `useEffect` 작성.

### Q6. 사용자/문서별 캐싱 및 버튼 구성 변경
* **해결**: `[이전 문장]` | `[다음 문장]` | `[작성 완료]` 버튼 구성 정립 및 `userProgressMap[userName][docId]` 구조로 개별 작성 상태 분리 캐싱.

### Q7. 관리자 접속 보안 강화
* **해결**: 비밀번호를 `admin!@#`로 변경 및 UI 상의 비밀번호 힌트 문구 전면 제거.

### Q8. AI 대화창에서 마크다운 코드 상자가 중간에 끊기거나 짤리는 현상
* **원인**: 마크다운 문서를 코드 상자(```)로 제공할 때 문서 내부의 코드 예시(```bash, ```typescript 등)의 백틱 3개 기호를 만나면서 외부 상자가 일찍 닫혀버리는 마크다운 문법 중첩 이슈.
* **해결**: AI가 답변 출력 시 최상위 코드 상자를 **백틱 4개(````markdown)**로 감싸서 내부에 백틱 3개 기호가 있더라도 상자가 조기 닫힘 없이 하나의 완성된 상자로 출력되도록 교정.

### Q9. 다양한 파일 확장자(.txt, .md, .csv 등) 파싱 시 에러 방지
* **원인**: 파싱 로직이 확장자를 구분하지 않고 모든 파일을 PDF 파서 엔진으로 처리하려다 `Invalid PDF structure` 에러 발생.
* **해결**: 파일 확장자를 자동 감지하여 `.pdf` 이외의 텍스트 기반 문서는 Native `fetch().text()`로 직접 읽어 들여 파싱하는 분기 로직 적용.

### Q10. 완주 후 재시작 시 이전 이력(v1.0) 소실 문제
* **원인**: 저장 키가 `[user][docId]` 단일 구조로 되어 있어 재필사 시 기존 완주 데이터가 덮어씌워짐.
* **해결**: `[docId_v1.0]`, `[docId_v2.0]`과 같이 버전별 독립 저장 키 구조로 리팩토링하여 이전 완주 기록 보존.

### Q11. AI 대화창에서 마크다운 코드 상자가 중간에 끊기거나 짤리는 현상
* **원인**: 마크다운 문서 내부의 백틱 3개(```) 기호 때문에 AI의 최상단 마크다운 상자가 조기에 닫히거나 출력 한도를 초과하는 현상 발생.
* **해결**: AI 답변 요청 시 최상단 상자를 백틱 4개(````markdown)로 감싸서 내부에 백틱 3개 기호가 있어도 상자가 끊기지 않고 하나로 완성되도록 프롬프트 가이드 정립.

---

## 💡 3. AI 프롬프트 작성 팁 (마크다운 문서 요청 시 가이드)

다음번에 AI에게 마크다운(`*.md`) 문서를 만들어달라고 할 때, 문서 끊김 없이 깔끔한 결과물을 받고 싶다면 프롬프트 끝에 아래 문구를 함께 적어주시면 됩니다.

* **추천 프롬프트 예시**:
  > "문서 내부 코드 블록 때문에 마크다운 상자가 조기 닫히지 않도록 **최상단 상자는 백틱 4개(````markdown)로 감싸서** 끊김 없는 하나의 코드 블록으로 작성해 주세요."

---

## 🚀 4. GitHub 커밋 안내

`QnA.md` 파일 저장 완료 후 아래 절차로 커밋 및 푸시를 진행합니다.

1. **GitHub Desktop** 앱 열기
2. 왼쪽 **Changes** 목록에서 `QnA.md` 파일 추가 확인
3. 하단 Summary 입력란에 **`docs: add comprehensive QnA.md troubleshooting guide`** 입력
4. **`Commit to main`** 버튼 클릭
5. 상단 **`Push origin`** 버튼을 클릭하여 GitHub 원격 저장소에 반영