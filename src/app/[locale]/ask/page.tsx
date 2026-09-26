'use client';

import {useState, useRef, useEffect} from 'react';
import {useTranslations} from 'next-intl';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer_type?: string;
  context_truncated?: boolean;
}

const EMERGENCY_KEYWORDS = ['chest pain', 'can\'t breathe', 'unconscious', 'stroke', 'emergency', 'ambulance', '911', '112', '108'];

function hasEmergencyKeyword(message: string): boolean {
  const lower = message.toLowerCase();
  return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
}

export default function AskPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'cross_record' | 'single_record'>('cross_record');
  const [error, setError] = useState('');
  const [showEmergencyBanner, setShowEmergencyBanner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
  }, [params]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    
    const userMessage = input.trim();
    setInput('');
    setError('');
    
    // Show emergency notice for emergency keywords
    if (hasEmergencyKeyword(userMessage)) {
      setShowEmergencyBanner(true);
    }
    
    const tempUserMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: userMessage,
    };
    
    setMessages(prev => [...prev, tempUserMsg]);
    setSending(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: userMessage,
          thread_id: threadId,
          mode,
          locale,
        }),
      });
      
      const data = await res.json();
      
      if (res.status === 429) {
        setError(t('chat.rateLimitExceeded'));
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
        return;
      }
      
      if (!res.ok) {
        setError(t('chat.errors.sendFailed'));
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
        return;
      }
      
      if (!threadId && data.thread_id) {
        setThreadId(data.thread_id);
      }
      
      const assistantMsg: Message = {
        id: data.assistant_message?.id || `asst-${Date.now()}`,
        role: 'assistant',
        content: data.assistant_message?.content || '',
        answer_type: data.assistant_message?.answer_type,
        context_truncated: data.assistant_message?.context_truncated,
      };
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        {id: data.user_message?.id || tempUserMsg.id, role: 'user', content: userMessage},
        assistantMsg,
      ]);
      
    } catch {
      setError(t('chat.errors.sendFailed'));
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  }

  function startNewThread() {
    setThreadId(null);
    setMessages([]);
    setError('');
    setShowEmergencyBanner(false);
  }

  return (
    <div className="page-container" style={{paddingBottom: 0, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 0px)'}}>
      <div className="page-header" style={{marginBottom: '1rem'}}>
        <h1 className="page-title">{t('chat.title')}</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1">
            <button
              className={`btn btn-sm ${mode === 'cross_record' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('cross_record')}
            >
              {t('chat.crossRecord')}
            </button>
            <button
              className={`btn btn-sm ${mode === 'single_record' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('single_record')}
            >
              {t('chat.singleRecord')}
            </button>
          </div>
          {messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={startNewThread}>
              + {t('chat.newThread')}
            </button>
          )}
        </div>
      </div>

      {/* Emergency notice */}
      {showEmergencyBanner && (
        <div className="notice notice-error" style={{marginBottom: '1rem'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{fontSize: '0.875rem', fontWeight: 500}}>{t('chat.emergencyNotice')}</p>
          <button onClick={() => setShowEmergencyBanner(false)} style={{marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem'}}>×</button>
        </div>
      )}

      {/* Messages area */}
      <div className="chat-messages" style={{flex: 1}}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="empty-state-text">{t('chat.empty')}</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id}>
            <div className={`chat-bubble chat-bubble-${msg.role}`}>
              {msg.content}
              {msg.answer_type === 'missing_info' && (
                <p style={{fontSize: '0.8125rem', opacity: 0.75, marginTop: '0.5rem', fontStyle: 'italic'}}>
                  {t('chat.noAnswer')}
                </p>
              )}
              {msg.context_truncated && (
                <p style={{fontSize: '0.8125rem', opacity: 0.75, marginTop: '0.5rem', fontStyle: 'italic'}}>
                  ℹ {t('chat.contextTruncated')}
                </p>
              )}
            </div>
            {msg.role === 'assistant' && (
              <p style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', paddingLeft: msg.role === 'assistant' ? '0' : 'auto'}}>
                {t('chat.disclaimer')}
              </p>
            )}
          </div>
        ))}

        {sending && (
          <div className="chat-bubble chat-bubble-assistant">
            <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
              <span className="text-muted text-small">{t('chat.thinking')}</span>
              <span style={{animation: 'pulse 1s ease infinite', display: 'inline-block', width: '6px', height: '6px', background: 'var(--color-teal-400)', borderRadius: '50%'}} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {error && (
          <div className="notice notice-error" style={{position: 'absolute', bottom: '100px', left: '1rem', right: '1rem', fontSize: '0.875rem'}}>
            {error}
          </div>
        )}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={t('chat.placeholder')}
          className="form-input"
          style={{resize: 'none', minHeight: '44px', maxHeight: '120px', flex: 1}}
          rows={1}
          disabled={sending}
          id="chat-input"
          aria-label={t('chat.placeholder')}
        />
        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          id="chat-send"
          aria-label={t('chat.send')}
          style={{flexShrink: 0}}
        >
          {sending ? (
            <span className="spinner" style={{width: '16px', height: '16px'}} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      <div className="disclaimer-strip">
        {t('chat.disclaimer')}
      </div>
    </div>
  );
}
