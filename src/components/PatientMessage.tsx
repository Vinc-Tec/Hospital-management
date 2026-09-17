import { useEffect, useState } from 'react';
import { Send, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { Modal, Button, Textarea, Badge } from './ui';

type Channel = 'sms' | 'whatsapp';
type LogRow = {
  id: string; channel: Channel; message: string; status: 'sent' | 'failed'; error: string | null;
  sent_by_name: string | null; created_at: string;
};

// This is the "actually send something" counterpart to the reminders
// automation and the Twilio integration -- both were real and wired,
// but there was no way for staff to use them from inside the app.
// Sends through the SAME per-tenant Twilio account connected at
// Settings > Integrations, via the send-patient-message Edge Function
// (which runs under the caller's own session, so RLS still governs
// exactly which patient/tenant this can ever touch).
export function PatientMessageModal({ patientId, patientName, onClose }: {
  patientId: string; patientName: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const [channel, setChannel] = useState<Channel>('sms');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<LogRow[] | null>(null);

  async function loadHistory() {
    const { data } = await supabase.from('patient_messages').select('id, channel, message, status, error, sent_by_name, created_at')
      .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20);
    setHistory((data as LogRow[] | null) ?? []);
  }

  useEffect(() => { loadHistory(); }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-patient-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patient_id: patientId, channel, message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ ok: true, text: t('msg.sent') });
        setMessage('');
        loadHistory();
      } else {
        setFeedback({ ok: false, text: data.message || data.error || t('msg.failed') });
      }
    } catch {
      setFeedback({ ok: false, text: t('msg.failed') });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t('msg.title')} — ${patientName}`}>
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['sms', 'whatsapp'] as Channel[]).map((c) => (
            <button key={c} onClick={() => setChannel(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${channel === c ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {c === 'sms' ? t('msg.channel.sms') : t('msg.channel.whatsapp')}
            </button>
          ))}
        </div>

        <Textarea label={t('msg.compose')} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={t('msg.placeholder')} />

        {feedback && (
          <p className={`text-sm flex items-center gap-1.5 ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {feedback.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {feedback.text}
          </p>
        )}

        <Button onClick={send} loading={sending} disabled={!message.trim()}><Send size={15} /> {t('msg.send')}</Button>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('msg.history')}</p>
          {history === null ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400">{t('msg.history_empty')}</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-2 text-sm">
                  <Badge color={h.status === 'sent' ? 'green' : 'red'}>{h.channel}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-700 truncate">{h.message}</p>
                    <p className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString()}{h.sent_by_name ? ` · ${h.sent_by_name}` : ''}{h.error ? ` · ${h.error}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export const MessageIcon = MessageSquare;
