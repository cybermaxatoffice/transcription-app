'use client';

import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 1. 타입 및 문서 매핑 정의
// ==========================================
interface UserHistory {
  version: string;
  completedAt: string;
  totalChars: number;
  typoCount: number;
  accuracy: number;
  typoRate: number;
  sentenceCount: number;
}

interface DocProgress {
  currentIndex: number;
  drafts: Record<number, string>;
  isCompleted: boolean;
  completedCount: number;
}

// 화면 노출용 문서 목록 (제목 <-> 파일명 매핑)
const DOC_MAPPING: Record<string, string> = {
  '금강경(금강반야바라밀경) (261문장)': 'sample.txt',
};

export default function TranscriptionApp() {
  // ==========================================
  // 2. 상태(State) 관리
  // ==========================================
  const [userName, setUserName] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // 화면 표시용 문서 제목 (default)
  const [selectedDocTitle, setSelectedDocTitle] = useState<string>('금강경(금강반야바라밀경) (261문장)');
  const [docTitles] = useState<string[]>(Object.keys(DOC_MAPPING));

  // 실제 로드할 파일명
  const selectedFileName = DOC_MAPPING[selectedDocTitle] || 'sample.txt';

  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // 입력 및 작성 상태
  const [input, setInput] = useState<string>('');
  const [sentenceDrafts, setSentenceDrafts] = useState<Record<number, string>>({});
  const [completedCount, setCompletedCount] = useState<number>(0);

  // 모달 및 UI 상태
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');

  // 이력 및 캐시
  const [userHistories, setUserHistories] = useState<UserHistory[]>([]);
  const [stats, setStats] = useState({ progress: 0, typoRate: 0, totalErrors: 0, totalChars: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ==========================================
  // 3. 파일 불러오기 및 문장 파싱 (.txt 기준)
  // ==========================================
  useEffect(() => {
    async function loadDocument() {
      try {
        const response = await fetch(`/data/${selectedFileName}`);
        if (!response.ok) throw new Error('파일을 불러올 수 없습니다.');
        const text = await response.text();

        // 마침표(.), 물음표(?), 느낌표(!), 줄바꿈(\n) 기준으로 문장 분할
        const parsedSentences = text
          .split(/(?<=[.?!])\s+|\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        setSentences(parsedSentences.length > 0 ? parsedSentences : ['내용이 없습니다.']);
        setCurrentIndex(0);
      } catch (error) {
        console.error('문서 로드 에러:', error);
        setSentences(['문서를 불러오는 중에 오류가 발생했습니다. public/data/sample.txt 파일을 확인해주세요.']);
      }
    }

    loadDocument();
  }, [selectedFileName]);

  // ==========================================
  // 4. 캐시 및 진행 상태 불러오기/저장
  // ==========================================
  useEffect(() => {
    if (!userName || !selectedFileName) return;

    const storageKey = `progress_${userName}_${selectedFileName}`;
    const savedProgress = localStorage.getItem(storageKey);

    if (savedProgress) {
      try {
        const parsed: DocProgress = JSON.parse(savedProgress);
        setCurrentIndex(parsed.currentIndex || 0);
        setSentenceDrafts(parsed.drafts || {});
        setCompletedCount(parsed.completedCount || 0);
        setInput(parsed.drafts[parsed.currentIndex || 0] || '');
      } catch (e) {
        console.error('진행 상태 복원 실패:', e);
      }
    } else {
      setCurrentIndex(0);
      setSentenceDrafts({});
      setCompletedCount(0);
      setInput('');
    }
  }, [userName, selectedFileName]);

  // 문장 이동 시 현재 입력값 갱신
  useEffect(() => {
    setInput(sentenceDrafts[currentIndex] || '');
  }, [currentIndex, sentenceDrafts]);

  // ==========================================
  // 5. 정확한 오타율 및 통계 연산 로직 (보정 완료)
  // ==========================================
  const calculateStats = (
    customDrafts?: Record<number, string>,
    customInput?: string,
    overrideCompletedCount?: number
  ) => {
    const activeDrafts = customDrafts ?? sentenceDrafts;
    const activeInput = customInput ?? input;

    let totalChars = 0;
    let totalErrors = 0;

    // 1. 전체 원문 글자 수 계산
    sentences.forEach((s) => {
      totalChars += s.length;
    });

    if (totalChars === 0) {
      return { progress: 0, typoRate: 0, totalErrors: 0, totalChars: 0 };
    }

    // 2. 전체 문장 순회하며 오타 수 정밀 연산
    sentences.forEach((origSentence, idx) => {
      // 현재 보고 있는 문장은 activeInput 참조, 그 외 문장은 activeDrafts 참조
      const userInput = idx === currentIndex ? activeInput : activeDrafts[idx] || '';

      if (userInput.length > 0) {
        const maxLen = Math.max(origSentence.length, userInput.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < userInput.length && i < origSentence.length) {
            if (userInput[i] !== origSentence[i]) {
              totalErrors++; // 글자가 틀린 경우
            }
          } else {
            totalErrors++; // 원문보다 짧거나 초과해서 친 경우
          }
        }
      }
    });

    const activeCompletedCount = overrideCompletedCount ?? completedCount;
    const progress = Math.min(100, Math.round((activeCompletedCount / sentences.length) * 100));
    const typoRate = Number(((totalErrors / totalChars) * 100).toFixed(1));

    return { progress, typoRate, totalErrors, totalChars };
  };

  // 실시간 입력 및 상태 변경 시 통계 업데이트
  useEffect(() => {
    if (sentences.length > 0) {
      setStats(calculateStats());
    }
  }, [input, sentenceDrafts, completedCount, sentences, currentIndex]);

  // ==========================================
  // 6. 이벤트 핸들러
  // ==========================================
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setIsLoggedIn(true);
    }
  };

  const handleSaveSentence = () => {
    const updatedDrafts = { ...sentenceDrafts, [currentIndex]: input };
    setSentenceDrafts(updatedDrafts);

    const isFirstComplete = !sentenceDrafts[currentIndex] && input.length > 0;
    const nextCompletedCount = isFirstComplete ? completedCount + 1 : completedCount;
    if (isFirstComplete) {
      setCompletedCount(nextCompletedCount);
    }

    // 로컬 스토리지 상태 저장
    const storageKey = `progress_${userName}_${selectedFileName}`;
    const progressData: DocProgress = {
      currentIndex,
      drafts: updatedDrafts,
      isCompleted: nextCompletedCount === sentences.length,
      completedCount: nextCompletedCount,
    };
    localStorage.setItem(storageKey, JSON.stringify(progressData));

    // 마지막 문장에서 작성 완료 클릭 시 정확한 최종 수치로 완주 처리
    if (currentIndex === sentences.length - 1) {
      const finalStats = calculateStats(updatedDrafts, input, nextCompletedCount);
      setStats(finalStats);
      saveToHistory(finalStats);
      setShowCompletionModal(true);
    }
  };

  const saveToHistory = (finalStats: ReturnType<typeof calculateStats>) => {
    const historyKey = `history_${userName}`;
    const existing = localStorage.getItem(historyKey);
    const histories: UserHistory[] = existing ? JSON.parse(existing) : [];

    const newHistory: UserHistory = {
      version: `v${histories.length + 1}.0`,
      completedAt: new Date().toLocaleString('ko-KR'),
      totalChars: finalStats.totalChars,
      typoCount: finalStats.totalErrors,
      accuracy: Math.max(0, Number((100 - finalStats.typoRate).toFixed(1))),
      typoRate: finalStats.typoRate,
      sentenceCount: sentences.length,
    };

    const updated = [newHistory, ...histories];
    localStorage.setItem(historyKey, JSON.stringify(updated));
    setUserHistories(updated);
  };

  const openHistoryModal = () => {
    const historyKey = `history_${userName}`;
    const existing = localStorage.getItem(historyKey);
    setUserHistories(existing ? JSON.parse(existing) : []);
    setShowHistoryModal(true);
  };

  const handleAdminAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin!@#') {
      alert('관리자 인증이 완료되었습니다.');
      setAdminPassword('');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  const isCurrentSentenceCompleted = Boolean(sentenceDrafts[currentIndex]);

  // ==========================================
  // 7. Render: 초기 로그인 화면
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 mb-6">
          <h1 className="text-4xl font-extrabold text-slate-800 mb-2">필사 서비스</h1>
          <p className="text-lg text-slate-600 mb-8">이름을 입력하고 필사할 글을 선택해 주세요.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xl font-bold text-slate-800 mb-2">사용자 이름</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="성함을 입력하세요"
                className="w-full text-xl p-4 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-slate-800 mb-2">필사문 제목 선택</label>
              <select
                value={selectedDocTitle}
                onChange={(e) => setSelectedDocTitle(e.target.value)}
                className="w-full text-xl p-4 border border-slate-300 rounded-xl bg-white focus:border-emerald-600 focus:outline-none"
              >
                {docTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-2xl font-bold py-4 rounded-xl shadow-md transition"
            >
              필사 시작하기
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-md w-full border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-3">관리자 로그인</h2>
          <form onSubmit={handleAdminAccess} className="flex gap-3">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="flex-1 text-lg p-3 border border-slate-300 rounded-xl focus:border-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-900 text-white text-lg font-bold px-6 py-3 rounded-xl transition"
            >
              접속
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 8. Render: 메인 필사 화면
  // ==========================================
  const currentTargetSentence = sentences[currentIndex] || '';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
      {/* 상단 헤더 */}
      <header className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow-md border border-slate-200 mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-2xl font-bold text-slate-800">{userName} 님</span>
          <span className="text-xl font-semibold text-emerald-600 ml-3">[{selectedDocTitle}]</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openHistoryModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold px-5 py-2.5 rounded-xl transition"
          >
            📜 내 필사 이력
          </button>
        </div>
      </header>

      {/* 통계 지표 대시보드 */}
      <div className="w-full max-w-4xl grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-2xl text-center">
          <div className="text-lg font-semibold text-emerald-700 mb-1">전체 진행률</div>
          <div className="text-4xl font-extrabold text-emerald-900">{stats.progress}%</div>
          <div className="text-sm text-emerald-600 mt-1">({completedCount} / {sentences.length} 문장)</div>
        </div>
        <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-2xl text-center">
          <div className="text-lg font-semibold text-rose-700 mb-1">현재 오타율</div>
          <div className="text-4xl font-extrabold text-rose-900">{stats.typoRate}%</div>
          <div className="text-sm text-rose-600 mt-1">(누적 오타 {stats.totalErrors}개)</div>
        </div>
      </div>

      {/* 필사 본문 카드 */}
      <main className="w-full max-w-4xl bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200 mb-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-xl font-bold text-emerald-600 mb-4">
            문장 {currentIndex + 1} / {sentences.length}
          </div>

          <div className="bg-slate-100 p-6 rounded-xl border-2 border-slate-300 mb-6 min-h-[120px]">
            <div className="text-2xl md:text-3xl font-medium tracking-wide leading-relaxed text-slate-800 break-keep">
              {currentTargetSentence.split('').map((char, i) => {
                let colorClass = 'text-slate-800';
                if (i < input.length) {
                  colorClass = input[i] === char ? 'text-slate-900 font-semibold' : 'text-rose-600 font-bold bg-rose-100 rounded px-0.5';
                }
                return (
                  <span key={i} className={colorClass}>
                    {char}
                  </span>
                );
              })}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isCurrentSentenceCompleted}
            readOnly={isCurrentSentenceCompleted}
            placeholder={isCurrentSentenceCompleted ? '작성 완료된 문장입니다.' : '위 문장을 보고 똑같이 입력하세요...'}
            className={`w-full text-2xl md:text-3xl p-5 border-2 rounded-xl min-h-[160px] focus:outline-none transition leading-relaxed ${
              isCurrentSentenceCompleted
                ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed'
                : 'border-emerald-400 focus:border-emerald-600 bg-white'
            }`}
          />
        </div>

        <div className="flex justify-between items-center gap-4 mt-8">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 text-xl font-bold px-6 py-4 rounded-xl transition"
          >
            ◀ 이전 문장
          </button>

          <button
            onClick={handleSaveSentence}
            disabled={isCurrentSentenceCompleted || input.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-2xl font-bold px-10 py-4 rounded-xl shadow-md transition"
          >
            작성 완료
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => Math.min(sentences.length - 1, prev + 1))}
            disabled={currentIndex === sentences.length - 1}
            className="bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 text-xl font-bold px-6 py-4 rounded-xl transition"
          >
            다음 문장 ▶
          </button>
        </div>
      </main>

      {/* 완주 모달 */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl border border-slate-200">
            <h2 className="text-4xl font-extrabold text-emerald-600 mb-4">🎉 필사 완주 축하합니다!</h2>
            <p className="text-xl text-slate-700 mb-6">모든 문장을 성공적으로 필사하셨습니다.</p>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-3 text-left text-xl">
              <div>• 최종 오타율: <span className="font-bold text-rose-600">{stats.typoRate}%</span></div>
              <div>• 총 오타 수: <span className="font-bold text-slate-800">{stats.totalErrors}개</span></div>
              <div>• Total 작성 문장: <span className="font-bold text-slate-800">{sentences.length}문장</span></div>
            </div>
            <button
              onClick={() => setShowCompletionModal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-2xl font-bold py-4 rounded-xl transition shadow-lg"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 이력 모달 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">📜 {userName} 님의 필사 이력</h2>
            <div className="overflow-y-auto flex-1 space-y-4 pr-2">
              {userHistories.length === 0 ? (
                <p className="text-xl text-slate-500 text-center py-12">완주된 필사 기록이 아직 없습니다.</p>
              ) : (
                userHistories.map((item, index) => (
                  <div key={index} className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-lg text-lg mr-3">
                        {item.version}
                      </span>
                      <span className="text-slate-500 text-base">{item.completedAt}</span>
                    </div>
                    <div className="text-right text-lg font-semibold">
                      <div className="text-slate-800">정확도: {item.accuracy}%</div>
                      <div className="text-rose-600 text-sm">오타율: {item.typoRate}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="mt-6 w-full bg-slate-700 hover:bg-slate-800 text-white text-xl font-bold py-3.5 rounded-xl transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}