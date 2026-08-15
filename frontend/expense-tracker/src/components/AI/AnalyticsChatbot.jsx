import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuSparkles, LuBot, LuX, LuSend, LuTrash2, LuHistory } from 'react-icons/lu';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import DynamicChartRenderer from './DynamicChartRenderer';
import AgentStateBadge from './AgentStateBadge';
import { useUserAuth } from '../../hooks/useUserAuth';

const SUGGESTIONS = [
  { label: '📊 Expenses by Category', query: 'Show me a bar chart of my expenses grouped by category' },
  { label: '💰 Income vs Expenses', query: 'Compare my total income vs total expenses' },
  { label: '📋 Last 5 Transactions', query: 'Show me the last 5 transactions' },
  { label: '📈 Income Sources', query: 'Show me my income distribution by source' },
  { label: '🔍 Last 3 Incomes', query: 'Show me my last 3 income entries' },
  { label: '📉 Last 3 Expenses', query: 'Show me my last 3 expense entries' },
];

const WELCOME_MSG = {
  id: 'welcome',
  sender: 'ai',
  text: '👋 Hello! I\'m your AI Financial Copilot.\n\nAsk me anything about your income, expenses, or trends — I\'ll remember our conversation context across questions too!',
};

const STORAGE_KEY_PREFIX = 'expense-tracker-chat:';
const MAX_HISTORY_TURNS = 5; // last N messages sent to backend for context

export const AnalyticsChatbot = () => {
  const { user } = useUserAuth();
  const userId = user?._id || user?.id || 'guest';
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { /* ignore parse errors */ }
    return [WELCOME_MSG];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentState, setAgentState] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Persist messages to localStorage whenever they change ──
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (_) { /* ignore quota errors */ }
  }, [messages, storageKey]);

  // ── Scroll to bottom on new messages ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentState, scrollToBottom]);

  // ── Focus input when drawer opens ──
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── Build chat history payload (last N turns, text only) ──
  const buildChatHistory = useCallback(
    (currentMessages) =>
      currentMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-MAX_HISTORY_TURNS * 2) // user + ai alternating
        .map((m) => ({ sender: m.sender, text: m.text })),
    []
  );

  // ── Send query to backend ──
  const handleSendQuery = async (queryText) => {
    const textToSubmit = (queryText || inputQuery).trim();
    if (!textToSubmit || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSubmit,
    };

    setMessages((prev) => {
      const updated = [...prev, userMsg];
      return updated;
    });
    setInputQuery('');
    setLoading(true);

    try {
      setAgentState('Parsing financial query...');
      await new Promise((r) => setTimeout(r, 350));

      // Capture current messages to build history (before state update settles)
      const chatHistory = buildChatHistory([...messages, userMsg]);

      setAgentState('Executing MongoDB aggregation pipeline...');
      const response = await axiosInstance.post(API_PATHS.AI.QUERY, {
        question: textToSubmit,
        chatHistory,
      });

      setAgentState('Generating insights & chart...');
      await new Promise((r) => setTimeout(r, 250));

      const aiData = response.data || {};
      const hasData = Array.isArray(aiData.data) && aiData.data.length > 0;

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiData.explanation || 'Analyzed your financial data.',
        chartProps: hasData
          ? {
              chartType: aiData.chartType || 'bar',
              chartTitle: aiData.chartTitle || 'Query Result',
              xAxisKey: aiData.xAxisKey || 'category',
              yAxisKey: aiData.yAxisKey || 'amount',
              data: aiData.data,
              summaryMetrics: aiData.summaryMetrics || {},
            }
          : null,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('[Chatbot Error]:', error);
      const errorMsg = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: error.response?.data?.message || '⚠️ Sorry, something went wrong processing your query. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setAgentState('');
    }
  };

  // ── Clear chat (resets to welcome, clears localStorage too) ──
  const handleClearChat = () => {
    const freshWelcome = { ...WELCOME_MSG, id: `welcome-${Date.now()}` };
    setMessages([freshWelcome]);
    try {
      localStorage.setItem(storageKey, JSON.stringify([freshWelcome]));
    } catch (_) {}
  };

  // ── Handle Enter key ──
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    }
  };

  const chatMessageCount = messages.filter((m) => m.sender === 'user').length;

  return (
    <>
      {/* Floating Copilot Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 text-white font-semibold text-sm shadow-2xl hover:scale-105 transition-all duration-300 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Open AI Financial Copilot"
      >
        <LuSparkles className="text-lg animate-pulse" />
        <span>AI Copilot</span>
        {chatMessageCount > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-white/25 text-[10px] flex items-center justify-center font-bold">
            {chatMessageCount > 9 ? '9+' : chatMessageCount}
          </span>
        )}
      </button>

      {/* Chatbot Drawer */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[92vw] max-w-[500px] h-[680px] max-h-[88vh] bg-slate-950/96 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
          role="dialog"
          aria-label="AI Financial Copilot"
        >
          {/* ── Header ── */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <LuBot className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  AI Financial Copilot
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <LuHistory className="text-[10px]" />
                  {chatMessageCount > 0 ? `${chatMessageCount} message${chatMessageCount !== 1 ? 's' : ''} · context preserved` : 'Natural language financial analytics'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Clear chat history"
                aria-label="Clear chat history"
              >
                <LuTrash2 className="text-sm" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors"
                aria-label="Close chatbot"
              >
                <LuX className="text-lg" />
              </button>
            </div>
          </div>

          {/* ── Messages Feed ── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap break-words ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-br-none shadow-lg shadow-indigo-900/40'
                      : 'bg-slate-900 border border-slate-800/80 text-slate-200 rounded-bl-none shadow-md'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Dynamic chart rendered below AI message */}
                {msg.sender === 'ai' && msg.chartProps && msg.chartProps.data?.length > 0 && (
                  <div className="w-full max-w-full mt-1">
                    <DynamicChartRenderer {...msg.chartProps} />
                  </div>
                )}

                {/* Empty state for AI response with no chart data */}
                {msg.sender === 'ai' && msg.chartProps === null && msg.id !== 'welcome' && msg.text.startsWith('No ') && (
                  <div className="text-[11px] text-slate-500 italic px-1">
                    No matching records found. Try a different keyword or add more data.
                  </div>
                )}
              </div>
            ))}

            {/* Agent State Badge while loading */}
            {loading && (
              <div className="flex flex-col items-start">
                <AgentStateBadge stateText={agentState} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Prompt Suggestion Chips ── */}
          <div className="px-3 py-2.5 bg-slate-900/50 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuery(s.query)}
                disabled={loading}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-indigo-600/30 hover:border-indigo-500/60 border border-slate-700 text-slate-300 hover:text-indigo-200 transition-all duration-200 disabled:opacity-40"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Input Footer ── */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask e.g. 'Show last 3 incomes' or 'Educational expenses'..."
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
              aria-label="Ask a financial question"
            />
            <button
              onClick={() => handleSendQuery()}
              disabled={loading || !inputQuery.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 disabled:opacity-40 text-white transition-all duration-200 shadow-lg shadow-indigo-900/40"
              aria-label="Send message"
            >
              <LuSend className="text-sm" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AnalyticsChatbot;
