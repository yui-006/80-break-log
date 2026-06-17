import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Flag, ArrowLeft } from 'lucide-react';

export function AuthPage() {
  const { signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ll-bg flex flex-col px-5 pt-12 pb-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-ll-mute mb-8 self-start active:text-ll-ink">
        <ArrowLeft size={18} /> 戻る
      </button>

      <div className="flex items-center gap-2 mb-10">
        <Flag size={26} className="text-ll-acc" />
        <span className="text-ll-ink text-xl font-black tracking-widest">80 BREAK LOG</span>
      </div>

      {sent ? (
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-6 shadow-card text-center">
          <div className="w-14 h-14 bg-ll-weak rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <p className="text-ll-ink font-bold text-lg mb-2">メールを確認してください</p>
          <p className="text-ll-mute text-sm leading-relaxed">
            <span className="text-ll-ink font-medium">{email}</span> にログインリンクを送りました。
            メール内のリンクをタップするとこのアプリに戻ります。
          </p>
          <p className="text-ll-dim text-xs mt-4">リンクの有効期限は1時間です</p>
        </div>
      ) : (
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-6 shadow-card">
          <p className="text-ll-ink font-bold text-xl mb-1">ログイン</p>
          <p className="text-ll-mute text-sm mb-6 leading-relaxed">
            メールアドレスにログインリンクを送ります。
            パスワード不要で安全にログインできます。
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              className="w-full border border-ll-line bg-ll-s2 text-ll-ink rounded-xl px-4 py-3.5 text-base placeholder:text-ll-dim"
            />
            {error && (
              <p className="text-ll-loss text-sm bg-ll-loss/5 border border-ll-loss/20 rounded-xl px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-ll-acc text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 active:opacity-80"
            >
              {loading ? '送信中…' : 'ログインリンクを送る'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-ll-line">
            <p className="text-xs text-ll-mute text-center leading-relaxed">
              ログインするとデータが複数デバイスで同期されます。
              ログインしなくてもこのデバイスで引き続き使えます。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
