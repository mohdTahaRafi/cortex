import { useState, useRef, useEffect } from "react";
import { parsePdf } from "@/utils/pdf-parser";
import { MessageFactory } from "@/utils/message-factory";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, FileUp, Send, BookOpen, Loader2 } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"summarize" | "chat" | "pdf">("summarize");

  // State
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [summaryFormat, setSummaryFormat] = useState("paragraphs");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [contextPct, setContextPct] = useState<number | null>(null);

  const activeRequestId = useRef<string>("");

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.action === "CHAT_CHUNK" && msg.payload.requestId === activeRequestId.current) {
        if (msg.payload.done) {
          setIsChatting(false);
          setIsSummarizing(false);
        } else {
          if (activeTab === "chat") {
            setChatHistory(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + msg.payload.chunk };
                return updated;
              } else {
                return [...prev, { role: "assistant", content: msg.payload.chunk }];
              }
            });
          } else if (activeTab === "summarize") {
            setSummary(prev => prev + msg.payload.chunk);
          }
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [activeTab]);

  const getActivePageText = async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return "";
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText,
      });
      return result[0]?.result || "";
    } catch (e) {
      return "";
    }
  };

  const getContext = async () => {
    let fullText = pdfText || await getActivePageText();
    if (!fullText.trim()) return "";
    
    // Simple truncation for RAG-lite context (approx 3000 words max)
    const words = fullText.split(/\s+/);
    const maxWords = 3000;
    if (words.length > maxWords) {
      setContextPct(Math.round((maxWords / words.length) * 100));
      return words.slice(0, maxWords).join(" ");
    }
    setContextPct(100);
    return fullText;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = await parsePdf(buffer);
      setPdfText(text);
      setPdfName(file.name);
    } catch (err) {
      console.error(err);
      alert("Failed to parse PDF.");
    } finally {
      setIsParsing(false);
    }
  };

  const openReadMode = async () => {
    if (!pdfText) return;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: "SET_READ_MODE_CONTENT",
        title: pdfName,
        content: pdfText,
      });
    }
  };

  const triggerSummarize = async () => {
    const context = await getContext();
    if (!context) {
      alert("No content available to summarize. Please load a PDF or open a valid webpage.");
      return;
    }
    setSummary("");
    setIsSummarizing(true);
    activeRequestId.current = Math.random().toString(36).slice(2);
    
    const prompt = `Summarize the following text. 
Length constraint: ${summaryLength}. 
Format: ${summaryFormat === 'structured' ? 'Executive Summary, Key Insights, and Key Terms Glossary' : summaryFormat}.
Text: ${context}`;

    chrome.runtime.sendMessage({
      action: "CHAT_SEND",
      payload: {
        messages: [{ role: "user", content: prompt }],
        requestId: activeRequestId.current
      }
    });
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;
    const context = await getContext();
    const newHistory = [...chatHistory, { role: "user", content: chatInput }];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatting(true);
    activeRequestId.current = Math.random().toString(36).slice(2);

    const systemMessage = {
      role: "system",
      content: `You are a helpful academic AI assistant. Answer questions strictly based on the provided document context. If the answer is not in the context, say so.\n\nContext:\n${context}`
    };

    chrome.runtime.sendMessage({
      action: "CHAT_SEND",
      payload: {
        messages: [systemMessage, ...newHistory],
        requestId: activeRequestId.current
      }
    });
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-indigo-500/20 shadow-lg">
            C
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Cortex Co-pilot</h1>
            <p className="text-[10px] text-slate-400">Research & Learning</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/50">
        <button 
          onClick={() => setActiveTab("summarize")}
          className={`flex-1 py-3 text-[11px] font-medium transition-all ${activeTab === "summarize" ? "text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/30" : "text-slate-400 hover:text-slate-200"}`}
        >
          <FileText className="mx-auto mb-1 h-4 w-4" /> Summarize
        </button>
        <button 
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 text-[11px] font-medium transition-all ${activeTab === "chat" ? "text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/30" : "text-slate-400 hover:text-slate-200"}`}
        >
          <MessageSquare className="mx-auto mb-1 h-4 w-4" /> Chat
        </button>
        <button 
          onClick={() => setActiveTab("pdf")}
          className={`flex-1 py-3 text-[11px] font-medium transition-all ${activeTab === "pdf" ? "text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/30" : "text-slate-400 hover:text-slate-200"}`}
        >
          <FileUp className="mx-auto mb-1 h-4 w-4" /> PDF Loader
        </button>
      </div>

      {/* Context Indicator */}
      {contextPct !== null && activeTab !== "pdf" && (
        <div className="bg-slate-900/80 px-4 py-1.5 text-[10px] text-slate-400 border-b border-slate-800/50 flex justify-between items-center">
          <span>Targeting {pdfName ? "PDF Document" : "Webpage"}</span>
          <span className={contextPct < 100 ? "text-amber-400" : "text-emerald-400"}>
            {contextPct}% of text in context
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* SUMMARIZE TAB */}
        {activeTab === "summarize" && (
          <div className="flex h-full flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-400">Length</label>
                <select 
                  value={summaryLength} 
                  onChange={e => setSummaryLength(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-400">Format</label>
                <select 
                  value={summaryFormat} 
                  onChange={e => setSummaryFormat(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  <option value="bullets">Bullets</option>
                  <option value="paragraphs">Paragraphs</option>
                  <option value="structured">Structured</option>
                </select>
              </div>
            </div>
            
            <Button 
              onClick={triggerSummarize} 
              disabled={isSummarizing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98]"
            >
              {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Summary
            </Button>

            {summary && (
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-inner">
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <div className="flex h-full flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {chatHistory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-50">
                  <MessageSquare className="mb-3 h-8 w-8" />
                  <p className="text-sm">Ask questions about this document.</p>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm shadow-md" : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleChatSubmit} className="mt-auto flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask something..."
                className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Button 
                type="submit" 
                disabled={!chatInput.trim() || isChatting}
                className="h-10 w-10 shrink-0 rounded-full bg-indigo-600 p-0 text-white hover:bg-indigo-700 shadow-md transition-transform active:scale-95 disabled:opacity-50"
              >
                {isChatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}

        {/* PDF TAB */}
        {activeTab === "pdf" && (
          <div className="flex h-full flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-sm rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-8 text-center transition-colors hover:border-indigo-500 hover:bg-slate-800 group">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handlePdfUpload}
              />
              <FileUp className="mx-auto mb-4 h-10 w-10 text-slate-400 group-hover:text-indigo-400 transition-colors" />
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Upload a PDF</h3>
              <p className="mb-6 text-xs text-slate-500">Local processing only. No data leaves your device.</p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                variant="outline"
                className="w-full border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              >
                {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Select File"}
              </Button>
            </div>

            {pdfText && (
              <div className="w-full max-w-sm rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 shadow-inner">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <p className="text-xs font-medium text-emerald-400 truncate flex-1">{pdfName}</p>
                </div>
                <Button 
                  onClick={openReadMode}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Read in Cortex Reader
                </Button>
                <p className="mt-3 text-center text-[10px] text-slate-500">
                  You can now use the Chat and Summarize tabs for this document.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
