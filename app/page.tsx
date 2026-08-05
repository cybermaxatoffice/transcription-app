'use client';

import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface DocumentData {
  id: string;
  title: string;
  sentences: string[];
}

interface UserProgress {
  docId: string;
  currentIndex: number;
  completedCount: number;
  sentenceDrafts: Record<number, string>;
  lastUpdated: string;
}

interface SectionItem {
  id: string;
  name: string;
  sentences: string[];
}

export default function TranscriptionApp() {
  const [viewMode, setViewMode] = useState<'login' | 'user' | 'admin'>('login');
  const [userName, setUserName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // 문서 및 진행 상황 데이터
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [sentenceDrafts, setSentenceDrafts] = useState<Record<number, string>>({});

  // 관리자 전용
  const [dataFileName, setDataFileName] = useState('sample1.pdf');
  const [extractedTitle, setExtractedTitle] = useState('');
  const [allParsedSentences, setAllParsedSentences] = useState<{ id: number; text: string; selected: boolean }[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // 진행 상태 맵
  const [userProgressMap, setUserProgressMap] = useState<Record<string, Record<string, UserProgress>>>({});

  // 초기 로드
  useEffect(() => {
    const loadedDocs = localStorage.getItem('transcription_docs');
    const loadedProgress = localStorage.getItem('transcription_progress');

    if (loadedDocs) {
      const parsedDocs: DocumentData[] = JSON.parse(loadedDocs);
      setDocuments(parsedDocs);
      if (parsedDocs.length > 0) setSelectedDocId(parsedDocs[0].id);
    } else {
      const defaultDoc: DocumentData = {
        id: 'default-1',
        title: '삶의 희망과 정성 (기본 샘플)',
        sentences: [
          "삶이 있는 한 희망은 있다.",
          "천천히 걸어도 정성을 다해 적어 내려가는 순간에 집중해 보세요."
        ]
      };
      setDocuments([defaultDoc]);
      setSelectedDocId(defaultDoc.id);
      localStorage.setItem('transcription_docs', JSON.stringify([defaultDoc]));
    }

    if (loadedProgress) {
      setUserProgressMap(JSON.parse(loadedProgress));
    }
  }, []);

  const currentDoc = documents.find((d) => d.id === selectedDocId);
  const currentSentence = currentDoc?.sentences[currentIndex] || '';

  // 문장 인덱스가 바뀔 때마다 캐시된 해당 문장 텍스트 동기화
  useEffect(() => {
    if (viewMode === 'user') {
      setInput(sentenceDrafts[currentIndex] || '');
    }
  }, [currentIndex, viewMode]);

  // 입력값 변경 시 내역 캐시 업데이트
  const handleInputChange = (val: string) => {
    setInput(val);
    setSentenceDrafts((prev) => ({
      ...prev,
      [currentIndex]: val
    }));
  };

  const resetAllAndGoToLogin = () => {
    setUserName('');
    setAdminPassword('');
    setInput('');
    setSentenceDrafts({});
    if (documents.length > 0) {
      setSelectedDocId(documents[0].id);
    } else {
      setSelectedDocId('');
    }
    setViewMode('login');
  };

  const saveUserProgress = (
    targetIndex: number,
    updatedDrafts: Record<number, string>,
    completedCountOverride?: number
  ) => {
    if (!userName || !selectedDocId) return;

    const trimmedUser = userName.trim();
    const newProgressMap = { ...userProgressMap };

    if (!newProgressMap[trimmedUser]) {
      newProgressMap[trimmedUser] = {};
    }

    const prevCount = newProgressMap[trimmedUser][selectedDocId]?.completedCount || 0;
    const newCompletedCount = completedCountOverride !== undefined 
      ? completedCountOverride 
      : prevCount;

    newProgressMap[trimmedUser][selectedDocId] = {
      docId: selectedDocId,
      currentIndex: targetIndex,
      completedCount: newCompletedCount,
      sentenceDrafts: updatedDrafts,
      lastUpdated: new Date().toLocaleString('ko-KR')
    };

    setUserProgressMap(newProgressMap);
    localStorage.setItem('transcription_progress', JSON.stringify(newProgressMap));
  };

  // 1. 이전 문장 버튼 (정확한 인덱스 감산 및 캐시 반영)
  const handlePrevSentence = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const updatedDrafts = { ...sentenceDrafts, [currentIndex]: input };
      setSentenceDrafts(updatedDrafts);
      saveUserProgress(prevIdx, updatedDrafts);

      setCurrentIndex(prevIdx);
    }
  };

  // 2. 다음 문장 버튼
  const handleNextSentence = () => {
    if (!currentDoc) return;
    const totalSentences = currentDoc.sentences.length;

    const updatedDrafts = { ...sentenceDrafts, [currentIndex]: input };
    setSentenceDrafts(updatedDrafts);

    if (currentIndex < totalSentences - 1) {
      const nextIdx = currentIndex + 1;
      saveUserProgress(nextIdx, updatedDrafts);
      setCurrentIndex(nextIdx);
    } else {
      saveUserProgress(currentIndex, updatedDrafts);
      alert('마지막 문장입니다.');
    }
  };

  // 3. 작성 완료 버튼
  const handleCompleteSentence = () => {
    if (!currentDoc) return;
    const totalSentences = currentDoc.sentences.length;

    const updatedDrafts = { ...sentenceDrafts, [currentIndex]: input };
    setSentenceDrafts(updatedDrafts);

    const currentCompleted = userProgressMap[userName.trim()]?.[selectedDocId]?.completedCount || 0;
    const newCompleted = Math.max(currentCompleted, currentIndex + 1);

    saveUserProgress(currentIndex, updatedDrafts, newCompleted);
    alert(`현재 문장 및 진행 상황이 저장되었습니다! (${newCompleted}/${totalSentences} 문장 완주)`);
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return alert('사용자 이름을 입력해 주세요.');
    if (!selectedDocId) return alert('필사할 필사문 제목을 선택해 주세요.');

    setViewMode('user');

    const existingProgress = userProgressMap[userName.trim()]?.[selectedDocId];
    if (existingProgress) {
      const savedIdx = existingProgress.currentIndex;
      const drafts = existingProgress.sentenceDrafts || {};
      setSentenceDrafts(drafts);
      setCurrentIndex(savedIdx);
      setInput(drafts[savedIdx] || '');
    } else {
      setCurrentIndex(0);
      setSentenceDrafts({});
      setInput('');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin!@#') {
      setViewMode('admin');
    } else {
      alert('비밀번호가 올바르지 않습니다. (기본: admin!@#)');
    }
  };

  const handleLoadFromDataDir = async () => {
    if (!dataFileName.trim()) return alert('파일명(예: sample1.pdf)을 입력해 주세요.');

    const filePath = `/data/${dataFileName.trim()}`;
    setExtractedTitle(dataFileName.replace('.pdf', ''));
    setSections([]);

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        return alert(`public/data/${dataFileName} 파일을 찾을 수 없습니다. 경로 및 파일명을 확인해 주세요.`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tokenProps = await page.getTextContent();
        const pageText = tokenProps.items.map((item: any) => item.str).join(' ');
        fullText += pageText + ' ';
      }

      const rawSentences = fullText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim().replace(/\s+/g, ' '))
        .filter((s) => s.length > 3);

      if (rawSentences.length > 0) {
        setAllParsedSentences(
          rawSentences.map((text, idx) => ({ id: idx, text, selected: false }))
        );
        setIsReviewing(true);
      } else {
        alert('PDF 내부에 추출 가능한 텍스트가 없습니다.');
      }
    } catch (error) {
      alert('PDF 파일 읽기 중 오류가 발생했습니다.');
    }
  };

  const toggleSentenceSelection = (id: number) => {
    setAllParsedSentences((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleAllSelection = (select: boolean) => {
    setAllParsedSentences((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleAddSection = () => {
    const selectedTexts = allParsedSentences
      .filter((item) => item.selected && item.text.trim().length > 0)
      .map((item) => item.text.trim());

    if (selectedTexts.length === 0) {
      return alert('구역으로 등록할 문장을 하나 이상 선택해 주세요.');
    }

    const name = sectionName.trim() || `구역 ${sections.length + 1}`;
    const newSection: SectionItem = {
      id: `sec-${Date.now()}`,
      name,
      sentences: selectedTexts
    };

    setSections([...sections, newSection]);
    setSectionName('');
    
    setAllParsedSentences((prev) =>
      prev.map((item) => (item.selected ? { ...item, selected: false } : item))
    );

    alert(`'${name}' 구역(${selectedTexts.length}개 문장)이 추가되었습니다.`);
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleConfirmDocument = () => {
    if (!extractedTitle.trim()) {
      return alert('필사문의 제목을 입력해 주세요.');
    }
    if (sections.length === 0) {
      return alert('최소 1개 이상의 구역을 추가해야 합니다.');
    }

    const mergedSentences = sections.flatMap((sec) => sec.sentences);

    const newDoc: DocumentData = {
      id: `doc-${Date.now()}`,
      title: extractedTitle.trim(),
      sentences: mergedSentences
    };

    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);
    localStorage.setItem('transcription_docs', JSON.stringify(updatedDocs));

    setIsReviewing(false);
    setSections([]);
    setExtractedTitle('');
    alert(`필사문 '${newDoc.title}'이(가) 성공적으로 등록되었습니다! (총 ${mergedSentences.length}개 문장)`);
  };

  // ---------------- 오타율 & 작성률 실시간 계산 (현재 input 최우선 적용) ----------------
  const calculateStats = () => {
    if (!currentDoc || currentDoc.sentences.length === 0) {
      return { completionRate: 0, errorRate: 0, totalOriginalChars: 0, totalTypedChars: 0 };
    }

    let totalOriginalChars = 0;
    let totalTypedChars = 0;
    let totalErrorChars = 0;

    currentDoc.sentences.forEach((origSentence, idx) => {
      totalOriginalChars += origSentence.length;

      // 현재 작성 중인 문장은 최신 input 값을 쓰고, 나머지는 sentenceDrafts 캐시값 참조
      const typed = idx === currentIndex ? input : (sentenceDrafts[idx] || '');
      totalTypedChars += typed.length;

      for (let i = 0; i < typed.length; i++) {
        if (i >= origSentence.length || typed[i] !== origSentence[i]) {
          totalErrorChars++;
        }
      }
    });

    const completionRate = totalOriginalChars > 0 
      ? Math.min(100, Math.round((totalTypedChars / totalOriginalChars) * 100)) 
      : 0;

    const errorRate = totalTypedChars > 0 
      ? Math.round((totalErrorChars / totalTypedChars) * 100) 
      : 0;

    return { completionRate, errorRate, totalOriginalChars, totalTypedChars };
  };

  const stats = calculateStats();

  // ---------------- 화면 렌더링 ----------------

  // 1. 로그인 화면
  if (viewMode === 'login') {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">필사 서비스</h1>
              <p className="text-xs text-slate-500 mt-1">이름을 입력하고 필사할 필사문 제목을 선택해 주세요.</p>
            </div>

            <form onSubmit={handleUserLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">사용자 이름</label>
                <input
                  type="text"
                  placeholder="사용자 이름 입력"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">필사문 제목 선택</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 font-medium"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.sentences.length}문장)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
              >
                필사 시작하기
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-600 mb-3">관리자 로그인</h2>
            <form onSubmit={handleAdminLogin} className="flex gap-2">
              <input
                type="password"
                placeholder="비밀번호"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="flex-1 p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <button
                type="submit"
                className="bg-slate-800 text-white text-xs px-4 py-2.5 rounded-lg font-medium hover:bg-slate-700"
              >
                관리자 접속
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // 2. 관리자 화면
  if (viewMode === 'admin') {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">관리자 대시보드</h1>
              <p className="text-xs text-slate-400 mt-1">data 디렉토리 기반 필사문 생성 및 사용자 관리</p>
            </div>
            <button
              onClick={resetAllAndGoToLogin}
              className="text-xs bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium hover:bg-slate-300"
            >
              로그아웃 (초기화)
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800">data 디렉토리 파일로 필사문 생성</h2>

            {!isReviewing ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-semibold text-slate-600 block">
                  transcription-app/public/data/ 경로의 PDF 파일명 입력:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="예: sample1.pdf"
                    value={dataFileName}
                    onChange={(e) => setDataFileName(e.target.value)}
                    className="flex-1 p-2.5 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                  <button
                    onClick={handleLoadFromDataDir}
                    className="bg-slate-800 text-white text-xs px-5 py-2.5 rounded-lg font-medium hover:bg-slate-700"
                  >
                    파일 불러오기 및 파싱
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-emerald-600">PDF 영역 분할 및 제목 지정</h3>
                  <button onClick={() => setIsReviewing(false)} className="text-xs text-slate-400 underline">
                    취소
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    필사문 제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="필사문 제목을 입력하세요 (예: 명심보감 1장)"
                    value={extractedTitle}
                    onChange={(e) => setExtractedTitle(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>

                {sections.length > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-800">추가된 구역 목록 ({sections.length}개)</h4>
                    <div className="space-y-1">
                      {sections.map((sec) => (
                        <div key={sec.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-emerald-100">
                          <span className="font-semibold text-slate-700">{sec.name} ({sec.sentences.length}개 문장)</span>
                          <button onClick={() => handleRemoveSection(sec.id)} className="text-red-500 hover:underline">삭제</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-100 rounded-xl space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="구역 이름 (예: 서문, 본문 1구역)"
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      onClick={handleAddSection}
                      className="bg-slate-800 text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-slate-700"
                    >
                      선택한 문장 구역 추가
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">PDF에서 추출된 문장 목록 ({allParsedSentences.length})</span>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => toggleAllSelection(true)} className="text-slate-600 underline">전체 선택</button>
                      <button onClick={() => toggleAllSelection(false)} className="text-slate-600 underline">전체 해제</button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    {allParsedSentences.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleSentenceSelection(item.id)}
                          className="mt-1 h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                        />
                        <span className="text-xs font-serif text-slate-700 leading-relaxed">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleConfirmDocument}
                  className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
                >
                  최종 필사문 등록 완료
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">등록된 필사문 목록 ({documents.length})</h3>
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {documents.map((doc) => (
                  <li key={doc.id} className="p-3 text-sm text-slate-700 flex justify-between bg-slate-50">
                    <span className="font-medium">{doc.title}</span>
                    <span className="text-xs text-slate-400">{doc.sentences.length}개 문장</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">사용자별 필사 진행 현황</h2>
            {Object.keys(userProgressMap).length === 0 ? (
              <p className="text-sm text-slate-400">학습 기록이 아직 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="p-3">사용자명</th>
                      <th className="p-3">필사문 제목</th>
                      <th className="p-3">완주 문장 수</th>
                      <th className="p-3">최근 학습 일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(userProgressMap).flatMap(([uName, userDocs]) =>
                      Object.entries(userDocs).map(([dId, pData]) => {
                        const targetDoc = documents.find((d) => d.id === dId);
                        const total = targetDoc?.sentences.length || 0;
                        return (
                          <tr key={`${uName}-${dId}`} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{uName}</td>
                            <td className="p-3">{targetDoc?.title || dId}</td>
                            <td className="p-3">
                              <span className="text-emerald-600 font-bold">{pData.completedCount}</span> / {total}
                            </td>
                            <td className="p-3 text-xs text-slate-400">{pData.lastUpdated}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // 3. 일반 사용자 필사 화면
  const totalSentences = currentDoc?.sentences.length || 0;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        
        {/* 상단 헤더 영역 */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs text-slate-400 font-medium">사용자: {userName}님</span>
            <h1 className="text-xl font-bold text-slate-800">{currentDoc?.title || '필사 연습'}</h1>
          </div>
          <button
            onClick={resetAllAndGoToLogin}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            제목 / 사용자 변경 (초기화)
          </button>
        </div>

        {/* 상단 실시간 연산 지표 카드 */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-xs text-slate-400 block mb-1">전체 문서 작성률</span>
              <span className="text-emerald-600 font-bold text-xl">{stats.completionRate}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">({stats.totalTypedChars} / {stats.totalOriginalChars} 글자)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-xs text-slate-400 block mb-1">현재 오타율</span>
              <span className={`font-bold text-xl ${stats.errorRate > 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                {stats.errorRate}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">(실시간 교정 반영)</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>작성 진행률</span>
              <span className="font-semibold text-slate-700">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-200/40 pt-2">
            <span>
              현재 위치: <strong className="text-slate-800 font-semibold">{currentIndex + 1}</strong> / {totalSentences} 문장
            </span>
          </div>
        </div>

        {/* 필사 입력 및 제어 영역 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
            <span>문장 {currentIndex + 1} / {totalSentences}</span>
            <span>현재 문장 작성률: <strong className="text-emerald-600">{Math.min(100, Math.round((input.length / (currentSentence.length || 1)) * 100))}%</strong></span>
          </div>

          <div className="p-5 bg-slate-50 rounded-xl text-slate-700 font-serif text-lg leading-relaxed border border-slate-200/60 select-none min-h-[100px]">
            {currentSentence.split('').map((char, index) => {
              let colorClass = 'text-slate-400';
              if (index < input.length) {
                colorClass = input[index] === char ? 'text-slate-900 font-bold' : 'text-red-500 bg-red-50';
              }
              return (
                <span key={index} className={`transition-colors duration-150 ${colorClass}`}>
                  {char}
                </span>
              );
            })}
          </div>

          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="위 문장을 똑같이 입력해 주세요..."
            rows={3}
            className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 font-serif text-lg text-slate-800 resize-none"
          />

          {/* 제어 버튼 영역 */}
          <div className="flex justify-between items-center pt-2 gap-3">
            <button
              onClick={handlePrevSentence}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              ◀ 이전 문장
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleNextSentence}
                disabled={currentIndex === totalSentences - 1}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-30"
              >
                다음 문장 ▶
              </button>

              <button
                onClick={handleCompleteSentence}
                className="bg-emerald-600 text-white font-medium text-xs px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                작성 완료
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}