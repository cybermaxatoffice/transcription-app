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
    
      
        
          하루 한 문장 필사
          
            진행률 {progress}%
          
        

        
          {SAMPLE_QUOTE.split('').map((char, index) => {
            let colorClass = 'text-slate-400';
            if (index < input.length) {
              colorClass = input[index] === char ? 'text-slate-900 font-bold' : 'text-red-500 bg-red-50';
            }
            return (
              
                {char}
              
            );
          })}
        

        
           setInput(e.target.value)}
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