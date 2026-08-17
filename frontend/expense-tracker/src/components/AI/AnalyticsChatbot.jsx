import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuSparkles, LuBot, LuX, LuSend, LuTrash2, LuHistory, LuZap } from 'react-icons/lu';
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
  text: "👋 Hello! I'm your Expense Copilot powered by Gemini.\n\nAsk me anything about your income, expenses, or spending trends — I understand natural language and remember our conversation!",
};

const STORAGE_KEY_PREFIX = 'expense-tracker-chat:';
const MAX_HISTORY_TURNS = 5;

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
    } catch (_) {}
    return [WELCOME_MSG];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentState, setAgentState] = useState('');
  const [quota, setQuota] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (_) {}
  }, [messages, storageKey]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentState, scrollToBottom]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const buildChatHistory = useCallback(
    (currentMessages) =>
      currentMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-MAX_HISTORY_TURNS * 2)
        .map((m) => ({ sender: m.sender, text: m.text })),
    []
  );

  const getQuotaColor = (remaining, total) => {
    if (!total) return 'text-muted-foreground';
    const pct = remaining / total;
    if (pct <= 0.2) return 'text-rose-500';
    if (pct <= 0.5) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const handleSendQuery = async (queryText) => {
    const textToSubmit = (queryText || inputQuery).trim();
    if (!textToSubmit || loading) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: textToSubmit };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      setAgentState('Analyzing with Gemini AI...');
      await new Promise((r) => setTimeout(r, 300));

      const chatHistory = buildChatHistory([...messages, userMsg]);

      setAgentState('Executing financial data query...');
      const response = await axiosInstance.post(API_PATHS.AI.QUERY, {
        question: textToSubmit,
        chatHistory,
      });

      setAgentState('Generating chart & insights...');
      await new Promise((r) => setTimeout(r, 200));

      const aiData = response.data || {};

      if (aiData.dailyLimit) {
        setQuota({
          used: aiData.queriesUsedToday,
          remaining: aiData.queriesRemaining,
          total: aiData.dailyLimit,
        });
      }

      const hasData = Array.isArray(aiData.data) && aiData.data.length > 0;
      const usedGemini = typeof aiData.engine === 'string' && aiData.engine.startsWith('gemini');

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiData.explanation || 'Analyzed your financial data.',
        usedGemini,
        engineLabel: aiData.engine,
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

      const isQuotaError = error.response?.status === 429;
      const errData = error.response?.data || {};

      if (isQuotaError && errData.dailyLimit) {
        setQuota({ used: errData.queriesUsedToday, remaining: 0, total: errData.dailyLimit });
      }

      const errorMsg = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        isQuotaError,
        text: isQuotaError
          ? `⏳ **Daily limit reached.**\n\n${errData.message || `You've used all ${errData.dailyLimit || 10} AI queries for today.`}\n\nYour quota resets at midnight UTC.`
          : error.response?.data?.message || '⚠️ Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setAgentState('');
    }
  };

  const handleClearChat = () => {
    const freshWelcome = { ...WELCOME_MSG, id: `welcome-${Date.now()}` };
    setMessages([freshWelcome]);
    try { localStorage.setItem(storageKey, JSON.stringify([freshWelcome])); } catch (_) {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendQuery(); }
  };

  const chatMessageCount = messages.filter((m) => m.sender === 'user').length;

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 text-white font-semibold text-sm shadow-2xl hover:scale-105 transition-all duration-300 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Open Expense Copilot"
      >
        <LuSparkles className="text-lg animate-pulse" />
        <span>Expense Copilot</span>
        {chatMessageCount > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-white/25 text-[10px] flex items-center justify-center font-bold">
            {chatMessageCount > 9 ? '9+' : chatMessageCount}
          </span>
        )}
      </button>

      {/* Chatbot Drawer */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[92vw] max-w-[500px] h-[700px] max-h-[90vh] bg-background/96 backdrop-blur-2xl border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
          role="dialog"
          aria-label="Expense Copilot"
        >
          {/* Header */}
          <div className="p-4 bg-card/90 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                <LuBot className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Expense Copilot
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                    <LuZap className="text-[9px]" /> Gemini
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <LuHistory className="text-[10px]" />
                  {chatMessageCount > 0 ? `${chatMessageCount} message${chatMessageCount !== 1 ? 's' : ''} · context preserved` : 'Ask anything about your finances'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClearChat} className="p-2 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-muted transition-colors" title="Clear chat" aria-label="Clear chat history">
                <LuTrash2 className="text-sm" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" aria-label="Close">
                <LuX className="text-lg" />
              </button>
            </div>
          </div>

          {/* Quota Bar */}
          {quota && (
            <div className="px-4 py-2 bg-card/60 border-b border-border/60 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-muted-foreground">Daily AI quota</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (quota.used / quota.total) * 100)}%`,
                      background: quota.remaining <= quota.total * 0.2
                        ? 'linear-gradient(90deg, #f87171, #ef4444)'
                        : quota.remaining <= quota.total * 0.5
                        ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                        : 'linear-gradient(90deg, #34d399, #10b981)',
                    }}
                  />
                </div>
                <span className={`text-[11px] font-medium ${getQuotaColor(quota.remaining, quota.total)}`}>
                  {quota.remaining}/{quota.total} left
                </span>
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs" aria-live="polite">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap break-words ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-br-none shadow-lg shadow-indigo-900/40'
                      : msg.isQuotaError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-bl-none'
                      : 'bg-card border border-border text-card-foreground rounded-bl-none shadow-md'
                  }`}
                >
                  {msg.text}
                  {msg.sender === 'ai' && msg.usedGemini && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500/70 dark:text-indigo-400/70">
                      <LuZap className="text-[9px]" /> {msg.engineLabel || 'Gemini'}
                    </div>
                  )}
                </div>

                {/* Dynamic Chart */}
                {msg.sender === 'ai' && msg.chartProps && msg.chartProps.data?.length > 0 && (
                  <div className="w-full max-w-full mt-1">
                    <DynamicChartRenderer {...msg.chartProps} />
                  </div>
                )}
              </div>
            ))}

            {/* Loading badge */}
            {loading && (
              <div className="flex flex-col items-start">
                <AgentStateBadge stateText={agentState} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="px-3 py-2.5 bg-card/50 border-t border-border/60 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuery(s.query)}
                disabled={loading || (quota && quota.remaining === 0)}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted hover:bg-indigo-500/10 hover:border-indigo-500/40 border border-border text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-card border-t border-border flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={quota?.remaining === 0 ? 'Daily quota reached. Resets at midnight UTC.' : "Ask e.g. 'Show last 3 incomes' or 'Food expenses this month'..."}
              disabled={loading || (quota && quota.remaining === 0)}
              className="flex-1 bg-background border border-border text-foreground placeholder-muted-foreground text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
              aria-label="Ask a financial question"
            />
            <button
              onClick={() => handleSendQuery()}
              disabled={loading || !inputQuery.trim() || (quota && quota.remaining === 0)}
              className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 disabled:opacity-40 text-white transition-all duration-200 shadow-lg shadow-indigo-900/40"
              aria-label="Send"
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
