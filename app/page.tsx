'use client';

import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

interface DocumentData {
  id: string;
  title: string;
  sentences: string[];
  disabled?: boolean;
}

interface UserProgress {
  docId: string;
  currentIndex: number;
  completedCount: number;
  sentenceDrafts: Record<number, string>;
  startDate: string;
  endDate?: string;
  lastUpdated: string;
  version: number;
  isCompleted?: boolean;
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
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('');

  // 완주 모달 팝업 상태
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsData, setCongratsData] = useState<{
    startDate: string;
    endDate: string;
    completionRate: number;
    errorRate: number;
  } | null>(null);

  // 사용자 이력 조회 모달 팝업 상태
  const [showUserHistoryModal, setShowUserHistoryModal] = useState(false);

  // 관리자 전용
  const [dataFileName, setDataFileName] = useState('sample1.pdf');
  const [extractedTitle, setExtractedTitle] = useState('');
  const [allParsedSentences, setAllParsedSentences] = useState<{ id: number; text: string; selected: boolean }[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // 진행 상태 맵 (버전별 독립 키 사용)
  const [userProgressMap, setUserProgressMap] = useState<Record<string, Record<string, UserProgress>>>({});

  // 초기 로드
  useEffect(() => {
    const loadedDocs = localStorage.getItem('transcription_docs');
    const loadedProgress = localStorage.getItem('transcription_progress');

    if (loadedDocs) {
      const parsedDocs: DocumentData[] = JSON.parse(loadedDocs);
      setDocuments(parsedDocs);
      const activeDocs = parsedDocs.filter((d) => !d.disabled);
      if (activeDocs.length > 0) setSelectedDocId(activeDocs[0].id);
    } else {
      const defaultDoc: DocumentData = {
        id: 'default-1',
        title: '삶의 희망과 정성 (기본 샘플)',
        sentences: [
          "삶이 있는 한 희망은 있다.",
          "천천히 걸어도 정성을 다해 적어 내려가는 순간에 집중해 보세요."
        ],
        disabled: false
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

  // 현재 문장이 이미 작성 완료된 상태인지 여부 (완료된 문장은 수정 및 버튼 비활성화)
  const isCurrentSentenceReadOnly = currentIndex < completedCount;

  // 버전별 고유 저장 키 생성
  const getProgressKey = (docId: string, ver: number) => `${docId}_v${ver}.0`;

  // 특정 문서의 가장 최근 진행 기록 구하기
  const getLatestUserProgress = (trimmedUser: string, docId: string) => {
    const userMap = userProgressMap[trimmedUser];
    if (!userMap) return null;

    const matchingKeys = Object.keys(userMap).filter((k) => k.startsWith(`${docId}_v`));
    if (matchingKeys.length === 0) return null;

    matchingKeys.sort((a, b) => {
      const vA = userMap[a].version || 1;
      const vB = userMap[b].version || 1;
      return vB - vA;
    });

    return userMap[matchingKeys[0]];
  };

  // 문장 인덱스 변경 시 해당 텍스트 동기화
  useEffect(() => {
    if (viewMode === 'user') {
      setInput(sentenceDrafts[currentIndex] || '');
    }
  }, [currentIndex, viewMode]);

  // 입력값 변경 시 (작성 완료되지 않은 현재 문장만 수정 가능)
  const handleInputChange = (val: string) => {
    if (isCurrentSentenceReadOnly) return;
    setInput(val);
    const updatedDrafts = { ...sentenceDrafts, [currentIndex]: val };
    setSentenceDrafts(updatedDrafts);
    saveUserProgress(currentIndex, updatedDrafts);
  };

  const resetAllAndGoToLogin = () => {
    setUserName('');
    setAdminPassword('');
    setInput('');
    setSentenceDrafts({});
    setCompletedCount(0);
    setShowCongratsModal(false);
    setShowUserHistoryModal(false);
    
    const activeDocs = documents.filter((d) => !d.disabled);
    if (activeDocs.length > 0) {
      setSelectedDocId(activeDocs[0].id);
    } else {
      setSelectedDocId('');
    }
    setViewMode('login');
  };

  const saveUserProgress = (
    targetIndex: number,
    updatedDrafts: Record<number, string>,
    completedCountOverride?: number,
    verOverride?: number,
    startOverride?: string,
    endDateOverride?: string
  ) => {
    if (!userName || !selectedDocId) return;

    const trimmedUser = userName.trim();
    const ver = verOverride || currentVersion || 1;
    const storageKey = getProgressKey(selectedDocId, ver);

    const newProgressMap = { ...userProgressMap };
    if (!newProgressMap[trimmedUser]) {
      newProgressMap[trimmedUser] = {};
    }

    const prevProg = newProgressMap[trimmedUser][storageKey];
    const prevCount = prevProg?.completedCount || 0;
    const newCompletedCount = completedCountOverride !== undefined 
      ? completedCountOverride 
      : Math.max(prevCount, completedCount);

    const totalSentences = currentDoc?.sentences.length || 0;
    const isComp = totalSentences > 0 && newCompletedCount >= totalSentences;

    const nowStr = new Date().toLocaleString('ko-KR');
    const startStr = startOverride || startDate || prevProg?.startDate || nowStr;
    const endStr = endDateOverride || (isComp ? (prevProg?.endDate || nowStr) : undefined);

    newProgressMap[trimmedUser][storageKey] = {
      docId: selectedDocId,
      currentIndex: targetIndex,
      completedCount: newCompletedCount,
      sentenceDrafts: updatedDrafts,
      startDate: startStr,
      endDate: endStr,
      lastUpdated: nowStr,
      version: ver,
      isCompleted: isComp
    };

    setUserProgressMap(newProgressMap);
    localStorage.setItem('transcription_progress', JSON.stringify(newProgressMap));
  };

  // 1. 이전 문장 버튼
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
    if (!currentDoc || isCurrentSentenceReadOnly) return;
    const totalSentences = currentDoc.sentences.length;

    const updatedDrafts = { ...sentenceDrafts, [currentIndex]: input };
    setSentenceDrafts(updatedDrafts);

    const newCompleted = Math.max(completedCount, currentIndex + 1);
    setCompletedCount(newCompleted);

    const nowStr = new Date().toLocaleString('ko-KR');

    // 현재 문장 저장
    saveUserProgress(currentIndex, updatedDrafts, newCompleted);

    // 마지막 문장에서 작성 완료 시 완주 축하 팝업 출력 (최신 completedCount 전달)
    if (newCompleted >= totalSentences) {
      saveUserProgress(currentIndex, updatedDrafts, newCompleted, undefined, undefined, nowStr);
      const finalStats = calculateStats(currentDoc, updatedDrafts, currentIndex, input, true, newCompleted);
      setCongratsData({
        startDate: startDate || nowStr,
        endDate: nowStr,
        completionRate: 100,
        errorRate: finalStats.errorRate
      });
      setShowCongratsModal(true);
    }
  };

  // 필사 시작하기
  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = userName.trim();
    if (!trimmedUser) return alert('사용자 이름을 입력해 주세요.');
    if (!selectedDocId) return alert('필사할 필사문 제목을 선택해 주세요.');

    const targetDoc = documents.find((d) => d.id === selectedDocId);
    if (targetDoc?.disabled) {
      return alert('현재 사용이 중지된 필사문입니다. 다른 필사문을 선택해 주세요.');
    }

    const latestProgress = getLatestUserProgress(trimmedUser, selectedDocId);
    const totalSentences = targetDoc?.sentences.length || 0;

    if (latestProgress && latestProgress.completedCount >= totalSentences && totalSentences > 0) {
      const currentVerNum = latestProgress.version || 1;
      const nextVerNum = currentVerNum + 1;

      if (confirm(`이미 완주한 필사문입니다.\n[v${nextVerNum}.0] 버전으로 새로 필사를 시작하시겠습니까?`)) {
        const nowStr = new Date().toLocaleString('ko-KR');
        const nextStorageKey = getProgressKey(selectedDocId, nextVerNum);

        setCurrentVersion(nextVerNum);
        setStartDate(nowStr);
        setCurrentIndex(0);
        setCompletedCount(0);
        setSentenceDrafts({});
        setInput('');

        const newProgressMap = { ...userProgressMap };
        if (!newProgressMap[trimmedUser]) newProgressMap[trimmedUser] = {};
        
        newProgressMap[trimmedUser][nextStorageKey] = {
          docId: selectedDocId,
          currentIndex: 0,
          completedCount: 0,
          sentenceDrafts: {},
          startDate: nowStr,
          lastUpdated: nowStr,
          version: nextVerNum,
          isCompleted: false
        };

        setUserProgressMap(newProgressMap);
        localStorage.setItem('transcription_progress', JSON.stringify(newProgressMap));
        setViewMode('user');
        return;
      }
    }

    setViewMode('user');
    if (latestProgress) {
      const savedIdx = latestProgress.currentIndex;
      const drafts = latestProgress.sentenceDrafts || {};
      setSentenceDrafts(drafts);
      setCompletedCount(latestProgress.completedCount || 0);
      setCurrentIndex(savedIdx);
      setInput(drafts[savedIdx] || '');
      setCurrentVersion(latestProgress.version || 1);
      setStartDate(latestProgress.startDate || new Date().toLocaleString('ko-KR'));
    } else {
      const nowStr = new Date().toLocaleString('ko-KR');
      setCurrentIndex(0);
      setCompletedCount(0);
      setSentenceDrafts({});
      setInput('');
      setCurrentVersion(1);
      setStartDate(nowStr);
      saveUserProgress(0, {}, 0, 1, nowStr);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin!@#') {
      setViewMode('admin');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleGoToUserModeFromAdmin = () => {
    if (!userName.trim()) {
      setUserName('관리자');
    }
    const activeDocs = documents.filter((d) => !d.disabled);
    if (activeDocs.length > 0) {
      if (!selectedDocId || documents.find((d) => d.id === selectedDocId)?.disabled) {
        setSelectedDocId(activeDocs[0].id);
      }
      setViewMode('user');
    } else {
      alert('현재 이용 가능한 필사문이 없습니다. 필사문을 먼저 생성하거나 사용재개해 주세요.');
    }
  };

  const handleDeleteUserProgress = (targetUserName: string, progressKey: string) => {
    const pData = userProgressMap[targetUserName]?.[progressKey];
    const targetDoc = documents.find((d) => d.id === pData?.docId);
    const docTitle = targetDoc?.title || progressKey;
    const verText = `v${pData?.version || 1}.0`;

    if (confirm(`[${targetUserName}] 님의 '${docTitle} (${verText})' 이력을 삭제하시겠습니까?`)) {
      const newProgressMap = { ...userProgressMap };
      if (newProgressMap[targetUserName]) {
        delete newProgressMap[targetUserName][progressKey];
        if (Object.keys(newProgressMap[targetUserName]).length === 0) {
          delete newProgressMap[targetUserName];
        }
      }
      setUserProgressMap(newProgressMap);
      localStorage.setItem('transcription_progress', JSON.stringify(newProgressMap));
      alert('필사 이력이 성공적으로 삭제되었습니다.');
    }
  };

  const handleLoadFromDataDir = async () => {
    const fileName = dataFileName.trim();
    if (!fileName) return alert('파일명(예: sample1.pdf, sample1.txt 등)을 입력해 주세요.');

    const filePath = `/data/${fileName}`;
    const cleanTitle = fileName.replace(/\.[^/.]+$/, '');
    setExtractedTitle(cleanTitle);
    setSections([]);

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        return alert(`public/data/${fileName} 파일을 서버에서 찾을 수 없습니다. (상태 코드: ${response.status})`);
      }

      let fullText = '';
      const isPdf = fileName.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
        });

        const pdf = await loadingTask.promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tokenProps = await page.getTextContent();
          const pageText = tokenProps.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
      } else {
        fullText = await response.text();
      }

      const rawSentences = fullText
        .split(/(?<=[.!?])\s+|\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (rawSentences.length > 0) {
        setAllParsedSentences(
          rawSentences.map((text, idx) => ({ id: idx, text, selected: false }))
        );
        setIsReviewing(true);
      } else {
        alert('파일 내부에 추출 가능한 텍스트가 없습니다.');
      }
    } catch (error: any) {
      console.error('File parsing detail error:', error);
      alert(`파일 파싱 오류 상세 내용:\n${error?.message || error || '알 수 없는 오류'}`);
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
      sentences: mergedSentences,
      disabled: false
    };

    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);
    localStorage.setItem('transcription_docs', JSON.stringify(updatedDocs));

    setIsReviewing(false);
    setSections([]);
    setExtractedTitle('');
    alert(`필사문 '${newDoc.title}'이(가) 성공적으로 등록되었습니다! (총 ${mergedSentences.length}개 문장)`);
  };

  const handleToggleDisableDoc = (id: string) => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    const willDisable = !targetDoc.disabled;
    const actionText = willDisable ? '사용중지' : '사용재개';

    if (confirm(`'${targetDoc.title}' 필사문을 ${actionText} 처리하시겠습니까?`)) {
      const updatedDocs = documents.map((doc) =>
        doc.id === id ? { ...doc, disabled: willDisable } : doc
      );

      setDocuments(updatedDocs);
      localStorage.setItem('transcription_docs', JSON.stringify(updatedDocs));

      if (selectedDocId === id && willDisable) {
        const nextActive = updatedDocs.find((d) => !d.disabled);
        setSelectedDocId(nextActive ? nextActive.id : '');
      }
    }
  };

  const handleDeleteDoc = (id: string) => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    if (confirm(`'${targetDoc.title}' 필사문을 완전히 삭제하시겠습니까?\n(이 작업은 복구할 수 없습니다.)`)) {
      const updatedDocs = documents.filter((doc) => doc.id !== id);

      setDocuments(updatedDocs);
      localStorage.setItem('transcription_docs', JSON.stringify(updatedDocs));

      if (selectedDocId === id) {
        const nextActive = updatedDocs.find((d) => !d.disabled);
        setSelectedDocId(nextActive ? nextActive.id : (updatedDocs[0]?.id || ''));
      }

      alert('필사문이 삭제되었습니다.');
    }
  };

  // 통계 연산 로직 (전체 원문 글자 수 기준, 비동기 completedCount 보정 매개변수 적용)
  const calculateStats = (
    targetDocData?: DocumentData,
    targetDrafts?: Record<number, string>,
    targetCurrIdx?: number,
    targetInputVal?: string,
    isCompletedFlag?: boolean,
    completedCountOverride?: number
  ) => {
    const docObj = targetDocData || currentDoc;
    if (!docObj || docObj.sentences.length === 0) {
      return { completionRate: 0, errorRate: 0, totalOriginalChars: 0, totalTypedChars: 0 };
    }

    const drafts = targetDrafts || sentenceDrafts;
    const cIdx = targetCurrIdx !== undefined ? targetCurrIdx : currentIndex;
    const currInput = targetInputVal !== undefined ? targetInputVal : input;
    const activeCompletedCount = completedCountOverride !== undefined ? completedCountOverride : completedCount;

    let totalOriginalChars = 0;
    let totalTypedChars = 0;
    let totalErrorChars = 0;

    docObj.sentences.forEach((origSentence, idx) => {
      totalOriginalChars += origSentence.length;

      const typed = idx === cIdx ? (currInput !== undefined ? currInput : (drafts[idx] || '')) : (drafts[idx] || '');
      totalTypedChars += typed.length;

      const compareLength = Math.min(origSentence.length, typed.length);
      for (let i = 0; i < compareLength; i++) {
        if (typed[i] !== origSentence[i]) {
          totalErrorChars++;
        }
      }

      // 완주된 문장의 빠진 문장부호/글자 오타 누적 반영
      if (idx < activeCompletedCount && typed.length < origSentence.length) {
        totalErrorChars += (origSentence.length - typed.length);
      }
    });

    let completionRate = 0;
    if (isCompletedFlag) {
      completionRate = 100;
    } else if (totalOriginalChars > 0) {
      completionRate = Math.min(100, Math.round((totalTypedChars / totalOriginalChars) * 100));
    }

    const errorRate = totalOriginalChars > 0 
      ? Math.round((totalErrorChars / totalOriginalChars) * 100)
      : 0;

    return { completionRate, errorRate, totalOriginalChars, totalTypedChars };
  };

  const stats = calculateStats();

  // ---------------- 화면 렌더링 ----------------

  // 1. 로그인 화면
  if (viewMode === 'login') {
    const activeDocuments = documents.filter((d) => !d.disabled);

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">필사 서비스</h1>
              <p className="text-base text-slate-600 mt-2 font-medium">이름을 입력하고 필사할 글을 선택해 주세요.</p>
            </div>

            <form onSubmit={handleUserLogin} className="space-y-5">
              <div>
                <label className="text-base font-extrabold text-slate-700 mb-1.5 block">사용자 이름</label>
                <input
                  type="text"
                  placeholder="성함을 입력하세요"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-4 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="text-base font-extrabold text-slate-700 mb-1.5 block">필사문 제목 선택</label>
                {activeDocuments.length > 0 ? (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full p-4 border border-slate-300 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 font-bold whitespace-normal"
                  >
                    {activeDocuments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.sentences.length}문장)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl text-base text-amber-800 font-bold">
                    현재 이용 가능한 필사문이 없습니다. (관리자에게 문의하세요)
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={activeDocuments.length === 0}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-colors text-lg shadow-sm disabled:opacity-50 whitespace-nowrap"
              >
                필사 시작하기
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-base font-bold text-slate-700 mb-3">관리자 로그인</h2>
            <form onSubmit={handleAdminLogin} className="flex gap-2">
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="flex-1 p-3 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <button
                type="submit"
                className="bg-slate-800 text-white text-base px-5 py-3 rounded-lg font-bold hover:bg-slate-700 whitespace-nowrap"
              >
                접속
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
            <div className="flex gap-2">
              <button
                onClick={handleGoToUserModeFromAdmin}
                className="text-sm bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-xs whitespace-nowrap"
              >
                필사 화면으로 이동 ✏️
              </button>
              <button
                onClick={resetAllAndGoToLogin}
                className="text-sm bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-bold hover:bg-slate-300 whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800">data 디렉토리 파일로 필사문 생성</h2>

            {!isReviewing ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-semibold text-slate-600 block">
                  transcription-app/public/data/ 경로의 파일명 입력 (PDF, TXT, MD, CSV 등 지원):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="예: sample1.pdf, sample1.txt 등"
                    value={dataFileName}
                    onChange={(e) => setDataFileName(e.target.value)}
                    className="flex-1 p-2.5 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                  <button
                    onClick={handleLoadFromDataDir}
                    className="bg-slate-800 text-white text-xs px-5 py-2.5 rounded-lg font-medium hover:bg-slate-700 whitespace-nowrap"
                  >
                    파일 불러오기 및 파싱
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-emerald-600">영역 분할 및 제목 지정</h3>
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
                      className="bg-slate-800 text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-slate-700 whitespace-nowrap"
                    >
                      선택한 문장 구역 추가
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">파일에서 추출된 문장 목록 ({allParsedSentences.length})</span>
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
                  className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors text-sm whitespace-nowrap"
                >
                  최종 필사문 등록 완료
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">등록된 필사문 목록 ({documents.length})</h3>
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {documents.map((doc) => (
                  <li key={doc.id} className="p-3.5 text-sm text-slate-700 flex justify-between items-center bg-slate-50 hover:bg-slate-100/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${doc.disabled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {doc.title}
                      </span>
                      <span className="text-xs text-slate-400">({doc.sentences.length}개 문장)</span>
                      {doc.disabled && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">
                          사용중지됨
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleDisableDoc(doc.id)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          doc.disabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        {doc.disabled ? '사용재개' : '사용중지'}
                      </button>

                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 관리자: 전체 사용자 필사 이력 대시보드 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">전체 사용자 필사 이력 대시보드</h2>
            {Object.keys(userProgressMap).length === 0 ? (
              <p className="text-sm text-slate-400">학습 이력이 아직 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100 text-slate-500 uppercase">
                    <tr>
                      <th className="p-3">누가 (사용자)</th>
                      <th className="p-3">필사명(버전)</th>
                      <th className="p-3">시작일</th>
                      <th className="p-3">종료일</th>
                      <th className="p-3">진행현황</th>
                      <th className="p-3">오타율</th>
                      <th className="p-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(userProgressMap).flatMap(([uName, userProgresses]) =>
                      Object.entries(userProgresses).map(([progKey, pData]) => {
                        const targetDoc = documents.find((d) => d.id === pData.docId);
                        const total = targetDoc?.sentences.length || 0;
                        const verStr = `v${pData.version || 1}.0`;
                        
                        const isDone = pData.isCompleted || (total > 0 && pData.completedCount >= total);
                        const calc = calculateStats(
                          targetDoc,
                          pData.sentenceDrafts,
                          pData.currentIndex,
                          pData.sentenceDrafts[pData.currentIndex] || '',
                          isDone
                        );

                        return (
                          <tr key={`${uName}-${progKey}`} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{uName}</td>
                            <td className="p-3 font-medium text-slate-700">
                              {targetDoc?.title || pData.docId} <span className="text-emerald-600 font-bold">({verStr})</span>
                            </td>
                            <td className="p-3 text-slate-500">{pData.startDate || '-'}</td>
                            <td className="p-3 text-slate-500">
                              {isDone ? (pData.endDate || pData.lastUpdated) : ''}
                            </td>
                            <td className="p-3">
                              {isDone ? (
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                  완주 ({pData.completedCount}/{total})
                                </span>
                              ) : (
                                <span className="whitespace-nowrap">
                                  진행 중 (<strong className="text-emerald-600">{pData.completedCount}</strong>/{total})
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-semibold">
                              <span className={calc.errorRate > 0 ? 'text-rose-500' : 'text-slate-700'}>
                                {calc.errorRate}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteUserProgress(uName, progKey)}
                                className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-2 py-1 rounded font-medium transition-colors whitespace-nowrap"
                              >
                                삭제
                              </button>
                            </td>
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
  const verStr = `v${currentVersion}.0`;

  const currentUserHistory = userProgressMap[userName.trim()] || {};

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-3 md:p-4 relative">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-4">
        
        {/* 상단 헤더 영역 */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div className="space-y-1">
            <span className="text-sm font-extrabold text-slate-600 block">사용자: {userName || '관리자'}님</span>
            <h1 className="text-xl md:text-2xl font-black text-slate-800">{currentDoc?.title || '필사 연습'}</h1>
            <div className="text-xs md:text-sm font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
              현재 버전: {verStr}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowUserHistoryModal(true)}
              className="text-xs md:text-sm bg-slate-100 text-slate-800 px-3 py-2 rounded-xl font-extrabold hover:bg-slate-200 transition-colors border border-slate-200 whitespace-nowrap"
            >
              내 필사 이력 📜
            </button>
            <button
              onClick={resetAllAndGoToLogin}
              className="text-xs md:text-sm bg-slate-200 text-slate-800 hover:bg-rose-100 hover:text-rose-700 px-3 py-2 rounded-xl font-extrabold transition-colors border border-slate-300 whitespace-nowrap"
            >
              필사종료
            </button>
          </div>
        </div>

        {/* 상단 실시간 연산 지표 카드 */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs md:text-sm font-extrabold text-slate-600 block mb-0.5">전체 문서 작성률</span>
              <span className="text-emerald-600 font-black text-lg md:text-xl">{stats.completionRate}%</span>
              <span className="text-xs font-semibold text-slate-500 block mt-0.5">({stats.totalTypedChars} / {stats.totalOriginalChars} 글자)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs md:text-sm font-extrabold text-slate-600 block mb-0.5">현재 오타율 (전체 원문 기준)</span>
              <span className={`font-black text-lg md:text-xl ${stats.errorRate > 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                {stats.errorRate}%
              </span>
              <span className="text-xs font-semibold text-slate-500 block mt-0.5">(전체 원문 글자 수 대비 계산)</span>
            </div>
          </div>

          <div className="space-y-1 pt-0.5">
            <div className="flex justify-between items-center text-xs md:text-sm font-extrabold text-slate-700">
              <span>작성 진행률</span>
              <span className="text-slate-900">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs md:text-sm font-extrabold text-slate-700 border-t border-slate-200/60 pt-2">
            <span>
              현재 위치: <strong className="text-slate-900 font-black text-base">{currentIndex + 1}</strong> / {totalSentences} 문장
            </span>
            <span className="text-xs font-semibold text-slate-500">시작일: {startDate || '-'}</span>
          </div>
        </div>

        {/* 필사 입력 및 제어 영역 */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs md:text-sm font-extrabold text-slate-600">
            <span>문장 {currentIndex + 1} / {totalSentences}</span>
            <div className="flex items-center gap-2">
              {isCurrentSentenceReadOnly && (
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                  🔒 작성 완료됨 (수정 불가)
                </span>
              )}
              <span>현재 문장 작성률: <strong className="text-emerald-600 text-sm md:text-base font-black">{Math.min(100, Math.round((input.length / (currentSentence.length || 1)) * 100))}%</strong></span>
            </div>
          </div>

          {/* 원문 및 입력 비교 상자 */}
          <div className="p-4 bg-slate-50 rounded-xl text-slate-800 font-serif text-lg leading-relaxed border border-slate-200/80 select-none min-h-[70px]">
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

          {/* 필사 입력 박스 (작성 완료 문장은 readOnly & disabled 처리) */}
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={isCurrentSentenceReadOnly}
            readOnly={isCurrentSentenceReadOnly}
            placeholder={isCurrentSentenceReadOnly ? "이미 작성 완료된 문장입니다." : "위 문장을 똑같이 입력해 주세요..."}
            rows={2}
            className={`w-full p-3.5 rounded-xl border font-serif text-lg text-slate-800 resize-none transition-colors ${
              isCurrentSentenceReadOnly
                ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed text-slate-600'
                : 'bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800'
            }`}
          />

          <div className="flex justify-between items-center pt-2 gap-2">
            <button
              onClick={handlePrevSentence}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm md:text-base font-extrabold bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-30 shadow-xs whitespace-nowrap"
            >
              ◀ 이전 문장
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleNextSentence}
                disabled={currentIndex === totalSentences - 1}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm md:text-base font-extrabold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-30 shadow-xs whitespace-nowrap"
              >
                다음 문장 ▶
              </button>

              {/* 작성 완료 버튼 */}
              <button
                onClick={handleCompleteSentence}
                disabled={isCurrentSentenceReadOnly}
                className={`font-extrabold text-sm md:text-base px-5 py-2.5 rounded-xl transition-colors shadow-md whitespace-nowrap ${
                  isCurrentSentenceReadOnly
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isCurrentSentenceReadOnly ? '완료됨' : '작성 완료'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 내 필사 이력 모달 */}
      {showUserHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-800">📜 {userName || '관리자'}님의 필사 이력</h2>
              <button
                onClick={() => setShowUserHistoryModal(false)}
                className="text-lg text-slate-500 hover:text-slate-800 font-extrabold whitespace-nowrap"
              >
                닫기 ✕
              </button>
            </div>

            {Object.keys(currentUserHistory).length === 0 ? (
              <p className="text-base font-medium text-slate-500 py-10 text-center">진행 중이거나 완료된 필사 이력이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm md:text-base text-slate-700 border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-extrabold">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">필사명(버전)</th>
                      <th className="p-3.5 whitespace-nowrap">작성률</th>
                      <th className="p-3.5 whitespace-nowrap">오타율</th>
                      <th className="p-3.5 whitespace-nowrap">시작일</th>
                      <th className="p-3.5 whitespace-nowrap">종료일</th>
                      <th className="p-3.5 text-center whitespace-nowrap">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {Object.entries(currentUserHistory).map(([progKey, pData]) => {
                      const targetDoc = documents.find((d) => d.id === pData.docId);
                      const total = targetDoc?.sentences.length || 0;
                      const vNumStr = `v${pData.version || 1}.0`;
                      const isDone = pData.isCompleted || (total > 0 && pData.completedCount >= total);

                      const isCurrentActiveDoc = selectedDocId === pData.docId && currentVersion === pData.version;
                      const draftsForCalc = isCurrentActiveDoc
                        ? { ...pData.sentenceDrafts, [currentIndex]: input }
                        : pData.sentenceDrafts;

                      const calc = calculateStats(
                        targetDoc,
                        draftsForCalc,
                        isCurrentActiveDoc ? currentIndex : pData.currentIndex,
                        isCurrentActiveDoc ? input : draftsForCalc[pData.currentIndex] || '',
                        isDone
                      );

                      return (
                        <tr key={progKey} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-800">
                            {targetDoc?.title || pData.docId} <span className="text-emerald-600 font-black">({vNumStr})</span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                            {calc.completionRate}% <span className="text-slate-500 text-xs font-semibold">({pData.completedCount}/{total})</span>
                          </td>
                          <td className="p-3.5 font-bold whitespace-nowrap">
                            <span className={calc.errorRate > 0 ? 'text-rose-500' : 'text-slate-800'}>
                              {calc.errorRate}%
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 whitespace-nowrap">{pData.startDate || '-'}</td>
                          <td className="p-3.5 text-slate-600 whitespace-nowrap">
                            {isDone ? (pData.endDate || pData.lastUpdated) : '-'}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isDone ? (
                              <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-bold text-xs">
                                완주됨 🎉
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold text-xs">
                                진행 중
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowUserHistoryModal(false)}
                className="bg-slate-800 text-white font-bold px-7 py-3 rounded-xl hover:bg-slate-700 transition-colors text-base whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 완주 축하 모달 팝업 */}
      {showCongratsModal && congratsData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-32 h-32 mx-auto rounded-full bg-emerald-50 flex items-center justify-center p-4">
              <img
                src="https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=300&auto=format&fit=crop"
                alt="축하 이미지"
                className="w-full h-full object-cover rounded-full shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800">🎉 완주를 축하합니다!</h2>
              <p className="text-base text-slate-600 font-semibold leading-relaxed">
                정성과 정성을 다해 필사문을 모두 마쳤습니다.<br />
                스스로의 노력과 끈기에 큰 박수를 보냅니다!
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
              <table className="w-full text-base text-slate-700 text-left">
                <tbody className="divide-y divide-slate-200/60 font-semibold">
                  <tr>
                    <th className="py-2.5 font-extrabold text-slate-600">필사문 버전</th>
                    <td className="py-2.5 text-right font-black text-emerald-600">{verStr}</td>
                  </tr>
                  <tr>
                    <th className="py-2.5 font-extrabold text-slate-600">작성 시작일</th>
                    <td className="py-2.5 text-right font-bold text-slate-800">{congratsData.startDate}</td>
                  </tr>
                  <tr>
                    <th className="py-2.5 font-extrabold text-slate-600">작성 종료일</th>
                    <td className="py-2.5 text-right font-bold text-slate-800">{congratsData.endDate}</td>
                  </tr>
                  <tr>
                    <th className="py-2.5 font-extrabold text-slate-600">최종 작성률</th>
                    <td className="py-2.5 text-right font-black text-emerald-600">{congratsData.completionRate}%</td>
                  </tr>
                  <tr>
                    <th className="py-2.5 font-extrabold text-slate-600">최종 오타율</th>
                    <td className="py-2.5 text-right font-black text-rose-500">{congratsData.errorRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setShowCongratsModal(false)}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors text-base shadow-md whitespace-nowrap"
            >
              확인 및 결과 닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}