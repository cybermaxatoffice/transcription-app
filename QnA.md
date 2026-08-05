# 📝 필사 서비스 프로젝트 구축 & 트러블슈팅 종합 가이드 (QnA.md)

본 문서는 필사 서비스 개발 과정에서 진행된 초기 개발 환경 구축, 핵심 라이브러리 간의 연관 관계 설정, 문제 발생 상황(Issue) 및 해결 방법(Troubleshooting)을 단 하나로 통합하여 정리한 종합 기술 문서입니다.

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

### 1.3 핵심 라이브러리 간 연관성 및 설치 방법
1. **`pdfjs-dist`**: PDF 문서 내부의 텍스트 데이터를 추출하여 필사용 문장 배열로 파싱합니다.
   * Node.js / Next.js 서버 사이드 렌더링(SSR)과의 호환성을 고려하여 **v3 버전을 사용하는 것이 가장 안정적**입니다.
   * **설치 명령어**:
     ```bash
     npm install pdfjs-dist@3.11.174 --save
     ```
2. **Worker Script 경로 연관성**:
   * `pdfjs-dist`가 PDF를 파싱하려면 백그라운드 스레드인 Worker 파일이 필요합니다. `page.tsx` 상단에 CDN 경로 설정이 필수입니다.
     ```typescript
     pdfjsLib.GlobalWorkerOptions.workerSrc = `//[cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js)`;
     ```

---

## 🛠️ 2. 트러블슈팅 및 Q&A (Troubleshooting & FAQs)

---

### Q1. VS Code에서 라이브러리를 설치했으나, GitHub Desktop의 Changes 목록에 변경사항이 감지되지 않습니다.

* **원인**:
  1. `npm install` 실행 시 `package.json` 파일의 변경 내용이 자동으로 저장되지 않았거나 디렉토리 인식 차이가 발생한 경우.
  2. 이미 이전에 커밋(Commit)이 완료되어 `History` 탭으로 넘어간 경우.
* **해결방법**:
  - `package.json` 파일을 직접 열어 `"dependencies"` 항목에 아래 패키지가 들어있는지 확인 후 `Ctrl + S`로 저장합니다.
    ```json
    "dependencies": {
      "pdfjs-dist": "3.11.174"
    }
    ```
  - GitHub Desktop 상단의 **`History`** 탭을 확인하여 이미 커밋되었는지 점검 후 **`Push origin`**을 실행합니다.

---

### Q2. `pdfjs-dist` 사용 중 `Warning: Please use the 'legacy' build in Node.js environments` 경고 및 빌드 오류가 발생합니다.

* **원인**:
  - `pdfjs-dist` 최신 버전(v4 이상)이 Next.js의 SSR(서버 사이드 렌더링) 환경 및 Canvas 연동과 충돌하여 발생하는 문제입니다.
* **해결방법**:
  1. `pdfjs-dist`를 Node.js/Next.js 호환성이 검증된 **v3 버전**으로 변경합니다.
     ```bash
     npm uninstall pdfjs-dist
     npm install pdfjs-dist@3.11.174 --save
     ```
  2. `next.config.ts` 파일에 서버 번들링 제외 설정을 추가합니다.
     ```typescript
     import type { NextConfig } from "next";

     const nextConfig: NextConfig = {
       serverExternalPackages: ["pdfjs-dist"],
     };

     export default nextConfig;
     ```

---

### Q3. 회사 망 보안 정책으로 인해 웹 브라우저상의 파일 업로드가 차단됩니다.

* **원인**:
  - 보안망 내에서는 `<input type="file" />` 형태의 직접적인 파일 업로드 기능 및 네트워크 전송이 제한될 수 있습니다.
* **해결방법**:
  - 웹 앱 정적 폴더인 `public/data/` 디렉토리에 PDF 파일들을 미리 위치시킨 후, 파일명(예: `sample1.pdf`)을 입력하거나 선택하여 서버 로컬 경로에서 `fetch()`로 읽어오는 방식으로 구현했습니다.
  ```typescript
  const filePath = `/data/${dataFileName.trim()}`;
  const response = await fetch(filePath);


### Q4. public/data 폴더에 파일이 있는데 Git에서 인식하지 못하거나 VS Code 탐색기에 표시되지 않습니다.
* **원인**:

1. 빈 폴더 문제: Git은 내용물이 없는 빈 디렉토리를 버전 관리 대상에서 제외합니다.

2. 확장자 중복 문제: 윈도우 탐색기에서 확장자 숨김 상태로 파일명을 변경하여 sample1.pdf.pdf와 같이 중복 확장자가 지정된 경우.

3. 중첩 폴더 구조: 프로젝트 상위 폴더와 하위 Next.js 폴더 간 구조 문제.

* **해결방법**:

transcription-app/public/data/ 경로에 파일을 정확히 위치시킵니다.

디렉토리가 비어있을 경우 .gitkeep 파일 생성 후 커밋합니다.

파일 확장자가 중복되지 않도록 영문/숫자 형태(sample1.pdf)로 깔끔하게 파일명을 정리합니다.

Q5. 오타를 수정해도 실시간 오타율이 반영되지 않고, 이전 문장 이동 시 문장 순서가 꼬입니다.
원인:

오타율 계산 시 작성 중인 최신 input 상태가 아닌 이전 캐시값만 참조하는 현상.

문장 인덱스(currentIndex) 변경 시 캐시 데이터 불러오기 타이밍이 비동기로 엇갈리면서 발생.

해결방법:

오타율 현행화: calculateStats() 연산 시 현재 작성 중인 인덱스의 input 값을 최우선 반영하도록 수정했습니다.

문장 순서 동기화: currentIndex가 변경될 때마다 해당 인덱스의 캐시 텍스트(sentenceDrafts[currentIndex])를 깔끔하게 동기화하도록 전용 useEffect를 적용했습니다.