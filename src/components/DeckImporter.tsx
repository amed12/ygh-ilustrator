'use client';

import React, { useState, useRef } from 'react';
import { UploadSimple, FileText, ArrowRight, Warning } from '@phosphor-icons/react';
import { parseDeck } from '../parser/ydk';
import { DeckList } from '../types';

interface DeckImporterProps {
  onImport: (deck: DeckList) => void;
}

const SAMPLE_RAIDRAPTOR_YDK = `#created by Yu-Gi-Oh Combo Engine
#main
53251824
53251824
53251824
83236601
83236601
83236601
96345188
96345188
31314549
31314549
87321742
87321742
08559793
23581825
23581825
#extra
73347079
73347079
08617563
36429703
96157835
59822133
43047672
21044178
90448279
26973555
!side
21044178`;

// YDKE contains the base64 LE representation of the same Raidraptor card IDs
const SAMPLE_RAIDRAPTOR_YDKE = 'ydke://gE3wMoBN8DKATfAysF67Q7Beu0OwXrtDMGWfjlBln441S8c9NkvHPTbRx0020cdNNn2nCjZ9pwo=!dywLRXcsC0V3LAtF75v4Nu+b+DbwB3a/1/p4P/k4C0U=!!';

export function DeckImporter({ onImport }: DeckImporterProps) {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (text: string) => {
    setError(null);
    try {
      const parsed = parseDeck(text);
      if (parsed.main.length === 0 && parsed.extra.length === 0) {
        throw new Error('Parsed deck list is empty. Please verify card passcodes.');
      }
      onImport(parsed);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Failed to parse deck list. Please verify format.';
      setError(err);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      setError('Please paste your deck data or file content.');
      return;
    }
    handleImport(inputText);
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setInputText(text);
        handleImport(text);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Title & Slogan */}
      <div className="text-center space-y-2">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
          Yu-Gi-Oh! Combo State Engine
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Prevent misplays by simulating and practicing branching deck combos under negated conditions.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative group rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          isDragActive 
            ? 'border-indigo-500 bg-indigo-500/5' 
            : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".ydk"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-zinc-900 p-3 text-zinc-400 border border-zinc-800 group-hover:scale-105 transition-transform">
            <UploadSimple size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-200">
              Drag & drop your .ydk file here
            </p>
            <p className="text-xs text-zinc-500">
              Or <button type="button" onClick={triggerFileInput} className="text-indigo-400 hover:underline">browse files</button> from your device
            </p>
          </div>
        </div>
      </div>

      {/* Text Area Input */}
      <form onSubmit={handleTextSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
            PASTE DECK DATA (YDK OR YDKE LINK)
          </label>
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="ydke://gE3wMoBN8DKATfAysF67Q7Beu0OwXrtDMGWfjlBln441S8c9NkvHPTbRx0020cdNNn2nCjZ9pwo=..."
              rows={4}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300 placeholder-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none leading-relaxed"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 leading-normal">
            <Warning size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Submit */}
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
          >
            <span>Parse & Load Deck</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>

      {/* Preloaded Samples Divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-900" />
        </div>
        <div className="relative flex justify-center text-xs font-mono uppercase tracking-wider">
          <span className="bg-zinc-950 px-3 text-zinc-600">Quick Testing</span>
        </div>
      </div>

      {/* Sample Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setInputText(SAMPLE_RAIDRAPTOR_YDK);
            handleImport(SAMPLE_RAIDRAPTOR_YDK);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/50 py-3 px-4 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
        >
          <FileText size={16} />
          <span>Load Raidraptor YDK</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setInputText(SAMPLE_RAIDRAPTOR_YDKE);
            handleImport(SAMPLE_RAIDRAPTOR_YDKE);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/50 py-3 px-4 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
        >
          <FileText size={16} />
          <span>Load Raidraptor YDKE</span>
        </button>
      </div>
    </div>
  );
}
