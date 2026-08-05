'use client';

import React, { useState, useEffect } from 'react';

const SAMPLE_QUOTE = "삶이 있는 한 희망은 있다. 천천히 걸어도 정성을 다해 적어 내려가는 순간에 집중해 보세요.";

export default function TranscriptionTestPage() {
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const currentProgress = Math.min(
      100,
      Math.round((input.length / SAMPLE_QUOTE.length) * 100)
    );
    setProgress(currentProgress);
  }, [input]);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-4">
          <h1 className="text-xl font-bold text-slate-800">하루 한 문장 필사</h1>
          <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            진행률 {progress}%
          </span>
        </div>

        <div className="mb-6 p-5 bg-slate-50 rounded-xl text-slate-700 font-serif text-lg leading-relaxed border border-slate-200/60 select-none">
          {SAMPLE_QUOTE.split('').map((char, index) => {
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

        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="위 문장을 똑같이 따라 적어보세요..."
            rows={4}
            className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-serif text-lg text-slate-800 resize-none"
          />
          
          <div className="flex justify-between items-center text-sm text-slate-500">
            <span>{input.length} / {SAMPLE_QUOTE.length} 자</span>
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