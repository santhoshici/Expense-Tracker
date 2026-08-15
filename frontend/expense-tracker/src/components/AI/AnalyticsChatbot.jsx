import React, { useState, useRef, useEffect } from 'react';
import { LuSparkles, LuBot, LuX, LuSend, LuTrash2 } from 'react-icons/lu';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import DynamicChartRenderer from './DynamicChartRenderer';
import AgentStateBadge from './AgentStateBadge';

const SUGGESTIONS = [
  { label: '📊 Expenses by Category', query: 'Show me a bar chart of my expenses grouped by category' },
  { label: '💰 Income vs Expenses', query: 'Compare my total income vs total expenses in a pie chart' },
  { label: '📋 Recent Transactions', query: 'Show me a table of my recent expense transactions' },
  { label: '📈 Income Sources', query: 'Show me my income distribution by source' },
];

export const AnalyticsChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your AI Financial Copilot. Ask me anything about your expenses, income trends, or category breakdowns.',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentState, setAgentState] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentState]);

  const handleSendQuery = async (queryText) => {
    const textToSubmit = queryText || inputQuery;
    if (!textToSubmit.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), sender: 'user', text: textToSubmit };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      setAgentState('Parsing financial query...');
      await new Promise((r) => setTimeout(r, 400));
      
      setAgentState('Executing MongoDB aggregation pipeline...');
      const response = await axiosInstance.post(API_PATHS.AI.QUERY, { question: textToSubmit });

      setAgentState('Generating chart & statistical insights...');
      await new Promise((r) => setTimeout(r, 300));

      const aiData = response.data || {};
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiData.explanation || 'Analyzed your financial data successfully.',
        generatedQuery: aiData.generatedQuery,
        chartProps: {
          chartType: aiData.chartType || 'bar',
          chartTitle: aiData.chartTitle || 'Query Result',
          xAxisKey: aiData.xAxisKey || 'category',
          yAxisKey: aiData.yAxisKey || 'amount',
          data: aiData.data || [],
          summaryMetrics: aiData.summaryMetrics || {},
        },
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('[Chatbot Error]:', error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: error.response?.data?.message || 'Sorry, I encountered an issue processing your query. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setAgentState('');
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: 'Chat cleared. Ask me a new financial question!',
      },
    ]);
  };

  return (
    <>
      {/* Floating Copilot Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 text-white font-semibold text-sm shadow-2xl hover:scale-105 transition-all duration-300 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <LuSparkles className="text-lg animate-bounce" />
        <span>AI Copilot</span>
      </button>

      {/* Chatbot Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] max-w-[480px] h-[640px] max-h-[85vh] bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <LuBot className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  AI Financial Data Copilot
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </h3>
                <p className="text-xs text-slate-400">Natural Language Text-to-Chart Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Clear Chat"
              >
                <LuTrash2 className="text-sm" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <LuX className="text-lg" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Render Dynamic Chart if AI returned chartProps */}
                {msg.sender === 'ai' && msg.chartProps && msg.chartProps.data?.length > 0 && (
                  <div className="w-full mt-2">
                    <DynamicChartRenderer {...msg.chartProps} />
                  </div>
                )}
              </div>
            ))}

            {/* Agent State Loading Badge */}
            {loading && (
              <div className="flex flex-col items-start">
                <AgentStateBadge stateText={agentState} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuery(s.query)}
                disabled={loading}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-300 hover:text-indigo-200 transition-all duration-200"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask e.g. 'Show me a bar chart of my expenses'..."
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
            >
              <LuSend className="text-sm" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AnalyticsChatbot;
