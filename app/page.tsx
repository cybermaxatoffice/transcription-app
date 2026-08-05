'use client';

import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DocumentData {
  id: string;
  title: string;
  sentences: string[];
}

interface UserProgress {
  docId: string;
  currentIndex: number;
  completedCount: number;
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
  const [progress, setProgress] = useState(0);

  // 관리자 전용: PDF 다중 구역 추출 상태
  const [extractedTitle, setExtractedTitle] = useState('');
  const [allParsedSentences, setAllParsedSentences] = useState<{ id: number; text: string; selected: boolean }[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // 사용자별 진행 현황 (사용자명 -> 문서ID -> 진행데이터)
  const [userProgressMap, setUserProgressMap] = useState<Record<string, Record<string, UserProgress>>>({});

  // 기존 등록된 사용자 이름 목록 (선택 용도)
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);

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
      const parsedProgress = JSON.parse(loadedProgress);
      setUserProgressMap(parsedProgress);
      setRegisteredUsers(Object.keys(parsedProgress));
    }
  }, []);

  const currentDoc = documents.find((d) => d.id === selectedDocId);
  const currentSentence = currentDoc?.sentences[currentIndex] || '';

  // 실시간 입력 진도율 계산
  useEffect(() => {
    if (!currentSentence) {
      setProgress(0);
      return;
    }
    const currentProgress = Math.min(
      100,
      Math.round((input.length / currentSentence.length) * 100)
    );
    setProgress(currentProgress);

    // 완벽하게 입력한 경우 자동 저장
    if (input === currentSentence && userName) {
      saveUserProgress(currentIndex + 1);
    }
  }, [input, currentSentence]);

  const saveUserProgress = (completedIndex: number) => {
    if (!userName || !selectedDocId) return;

    const newProgressMap = { ...userProgressMap };
    if (!newProgressMap[userName]) newProgressMap[userName] = {};

    const prevCount = newProgressMap[userName][selectedDocId]?.completedCount || 0;
    
    newProgressMap[userName][selectedDocId] = {
      docId: selectedDocId,
      currentIndex,
      completedCount: Math.max(prevCount, completedIndex),
      lastUpdated: new Date().toLocaleString('ko-KR')
    };

    setUserProgressMap(newProgressMap);
    if (!registeredUsers.includes(userName)) {
      setRegisteredUsers([...registeredUsers, userName]);
    }
    localStorage.setItem('transcription_progress', JSON.stringify(newProgressMap));
  };

  // 일반 사용자 진입
  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return alert('이름을 입력하거나 선택해 주세요.');
    if (!selectedDocId) return alert('필사할 문서(필사문)를 선택해 주세요.');

    setViewMode('user');

    // 선택한 문서의 기존 진도가 있다면 해당 인덱스로 이동
    const existingProgress = userProgressMap[userName]?.[selectedDocId];
    if (existingProgress) {
      setCurrentIndex(existingProgress.currentIndex);
    } else {
      setCurrentIndex(0);
    }
    setInput('');
  };

  // 관리자 진입
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setViewMode('admin');
    } else {
      alert('비밀번호가 올바르지 않습니다. (기본: admin123)');
    }
  };

  // PDF 파싱
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractedTitle(file.name.replace('.pdf', ''));
    setSections([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
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
        alert('문서를 읽을 수 없거나 텍스트가 없습니다.');
      }
    } catch (error) {
      alert('PDF 읽기 오류가 발생했습니다.');
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

  // 관리자 - 최종 문서 등록
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

  // ---------------- 화면 렌더링 ----------------

  // 1. 초기 로그인/설정 화면
  if (viewMode === 'login') {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* 일반 사용자 영역 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">필사 서비스</h1>
              <p className="text-xs text-slate-500 mt-1">이름과 필사할 필사문 제목을 선택해 주세요.</p>
            </div>

            <form onSubmit={handleUserLogin} className="space-y-4">
              {/* 사용자 이름 선택/입력 */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">사용자 이름</label>
                {registeredUsers.length > 0 && (
                  <select
                    onChange={(e) => setUserName(e.target.value)}
                    value={userName}
                    className="w-full p-2.5 mb-2 border border-slate-300 rounded-xl text-sm bg-slate-50"
                  >
                    <option value="">--기존 등록된 이름에서 선택--</option>
                    {registeredUsers.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="또는 새 사용자 이름 직접 입력"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              {/* 필사문 제목 선택 */}
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

          {/* 관리자 영역 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-600 mb-3">관리자 로그인</h2>
            <form onSubmit={handleAdminLogin} className="flex gap-2">
              <input
                type="password"
                placeholder="비밀번호 (admin123)"
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
              <p className="text-xs text-slate-400 mt-1">필사문 제목 지정, 구역 분할 및 사용자 현황 관리</p>
            </div>
            <button
              onClick={() => setViewMode('login')}
              className="text-xs bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium hover:bg-slate-300"
            >
              로그아웃
            </button>
          </div>

          {/* PDF 업로드 및 다중 구역 지정 영역 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800">새 필사문 등록</h2>

            {!isReviewing ? (
              <label className="inline-block cursor-pointer bg-slate-800 text-white text-sm px-5 py-3 rounded-xl font-medium hover:bg-slate-700">
                PDF 파일 불러오기
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              </label>
            ) : (
              <div className="space-y-6 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-emerald-600">PDF 영역 분할 및 제목 지정</h3>
                  <button onClick={() => setIsReviewing(false)} className="text-xs text-slate-400 underline">
                    취소
                  </button>
                </div>

                {/* 필사문 제목 입력 */}
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

                {/* 등록된 구역 요약 목록 */}
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

                {/* 구역 이름 입력 및 선택 문장 구역 추가 */}
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

                {/* 전체 추출 문장 목록 */}
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

          {/* 사용자별 현황 */}
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
                      <th className="p-3">진행률</th>
                      <th className="p-3">최근 학습 일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(userProgressMap).flatMap(([uName, userDocs]) =>
                      Object.entries(userDocs).map(([dId, pData]) => {
                        const targetDoc = documents.find((d) => d.id === dId);
                        const total = targetDoc?.sentences.length || 0;
                        const percent = total > 0 ? Math.round((pData.completedCount / total) * 100) : 0;
                        return (
                          <tr key={`${uName}-${dId}`} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{uName}</td>
                            <td className="p-3">{targetDoc?.title || dId}</td>
                            <td className="p-3">
                              <span className="text-emerald-600 font-bold">{percent}%</span> ({pData.completedCount}/{total})
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
  const myProgress = userProgressMap[userName]?.[selectedDocId];
  const totalSentences = currentDoc?.sentences.length || 0;
  const completedCount = myProgress?.completedCount || 0;
  const overallPercent = totalSentences > 0 ? Math.round((completedCount / totalSentences) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs text-slate-400 font-medium">사용자: {userName}님</span>
            <h1 className="text-xl font-bold text-slate-800">{currentDoc?.title || '필사 연습'}</h1>
          </div>
          <button
            onClick={() => setViewMode('login')}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            제목 / 사용자 변경
          </button>
        </div>

        {/* 내 완성도 바 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>내 완성도 ({completedCount}/{totalSentences} 문장)</span>
            <span className="font-bold text-emerald-600">{overallPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${overallPercent}%` }} />
          </div>
        </div>

        {/* 현재 필사 영역 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
            <span>문장 {currentIndex + 1} / {totalSentences}</span>
            <span>입력 진도: <strong className="text-emerald-600">{progress}%</strong></span>
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
            onChange={(e) => setInput(e.target.value)}
            placeholder="위 문장을 똑같이 입력해 주세요..."
            rows={3}
            className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 font-serif text-lg text-slate-800 resize-none"
          />

          <div className="flex justify-between items-center text-sm">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (currentIndex > 0) {
                    const newIdx = currentIndex - 1;
                    setCurrentIndex(newIdx);
                    setInput('');
                  }
                }}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-30"
              >
                이전 문장
              </button>
              <button
                onClick={() => {
                  if (currentIndex < totalSentences - 1) {
                    const newIdx = currentIndex + 1;
                    setCurrentIndex(newIdx);
                    setInput('');
                  }
                }}
                disabled={currentIndex === totalSentences - 1}
                className="px-3 py-1.5 rounded border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-30"
              >
                다음 문장
              </button>
            </div>

            <button
              onClick={() => setInput('')}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              초기화
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}