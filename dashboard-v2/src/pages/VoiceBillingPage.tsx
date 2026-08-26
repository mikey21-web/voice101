import { useEffect, useState } from 'react';
import { Wallet, Clock, TrendingDown, Plus, Zap, Receipt, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface RateCard { sarvamPerMin: number; smallestPerMin: number; cartesiaPerMin: number; inworldPerMin: number; llmPerUse: number; numberMonthly: number; extraChannelMonthly: number; hireFeeMonthly: number; gst: number; }
interface WalletData { balanceInr: number; transactions: any[]; }
interface BillingData { credits: number; talkTimeRemainingMin: number; runwayDays: number; dailyBurnInr: number; employees: any[]; rates: RateCard; lifetime: { spentInr: number; minutesUsedTotal: number }; }

const TIERS = [
  { name: 'Value', price: 3.5, desc: 'Everyday calling', provider: 'Sarvam' },
  { name: 'Standard', price: 5, desc: 'More natural', provider: 'Smallest.ai' },
  { name: 'Premium', price: 7, desc: 'Most lifelike', provider: 'Cartesia' },
  { name: 'Premium+', price: 8, desc: 'Flagship', provider: 'Inworld' },
];

const PACKS = [200, 500, 1000, 2000];

export default function VoiceBillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(500);
  const [topup, setTopup] = useState(false);
  const [tab, setTab] = useState<'credits' | 'transactions' | 'rates'>('credits');

  const load = () => {
    setLoading(true);
    Promise.all([
      api('/voice-billing').then(setBilling).catch(() => {}),
      api('/voice-wallet').then(setWallet).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const doTopup = async () => {
    setTopup(true);
    try {
      const order: any = await api('/voice-wallet/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      const verify: any = await api('/voice-wallet/topup/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: order.order_id }) });
      setWallet(verify.wallet);
      toast.success(`Added ₹${amount} credits`);
      load();
    } catch (e: any) { toast.error(e.message || 'Top-up failed'); }
    finally { setTopup(false); }
  };

  if (loading && !billing) return <div className="p-10 text-center text-sm text-gray-400"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</div>;

  const rates = billing?.rates;
  const tx = wallet?.transactions || [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400">BILLING</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Credits &amp; billing</h1>
        <p className="mt-1 text-sm text-gray-500">Everything runs on credits · 1 credit = ₹1 · they never expire</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-500"><Wallet className="h-4 w-4" /> Credits balance</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">₹{billing?.credits ?? 0}</p>
          {billing && billing.credits < 20 && <p className="mt-1 text-xs font-semibold text-amber-600">Low balance</p>}
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-500"><Clock className="h-4 w-4" /> Talk time left</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{billing?.talkTimeRemainingMin ?? 0} min</p>
          <p className="mt-1 text-xs text-gray-400">~{billing?.talkTimeRemainingMin ?? 0} min on Premium</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-500"><TrendingDown className="h-4 w-4" /> Runway</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{billing?.runwayDays ?? 0} days</p>
          <p className="mt-1 text-xs text-gray-400">₹{billing?.dailyBurnInr ?? 0} per day</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-500"><Zap className="h-4 w-4" /> Spent lifetime</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">₹{billing?.lifetime?.spentInr ?? 0}</p>
          <p className="mt-1 text-xs text-gray-400">{billing?.lifetime?.minutesUsedTotal ?? 0} min total</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-violet-500" /> Add credits</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PACKS.map((p) => (
              <button key={p} onClick={() => setAmount(p)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${amount === p ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ₹{p}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} type="number" min={1}
              className="w-32 rounded-lg border px-3 py-2 text-sm" />
            <button onClick={doTopup} disabled={topup} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {topup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add credits
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">Instant — never expires.</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold"><Receipt className="h-4 w-4 text-violet-500" /> Recent transactions</h2>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {tx.length === 0 ? <p className="py-4 text-center text-sm text-gray-400">No transactions yet</p> : tx.slice(0, 10).map((t, i) => (
              <div key={i} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <div>
                  <p className="font-medium capitalize">{t.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <p className={`font-semibold ${t.amount >= 0 ? 'text-emerald-600' : 'text-gray-700'}`}>{t.amount >= 0 ? '+' : ''}₹{t.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">What calls cost</h2>
        <p className="mt-1 text-xs text-gray-500">Charged per minute, by the voice each employee uses — set on its Voice tab. Nobody picks up? You pay ₹0.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t.name} className={`rounded-xl border p-4 ${t.name === 'Premium+' ? 'border-violet-300 bg-violet-50' : ''}`}>
              <p className="text-xs font-bold tracking-widest text-gray-400">{t.name}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">₹{t.price}<span className="text-sm font-normal text-gray-400">/min</span></p>
              <p className="mt-1 text-xs text-gray-500">{t.desc}</p>
              <p className="mt-0.5 text-xs text-violet-500">{t.provider}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
          <p>💳 Billed in 30-second blocks. A call under 30s costs half a minute.</p>
          <p>📞 A phone number: ₹{rates?.numberMonthly ?? 649}/month · extra channel ₹{rates?.extraChannelMonthly ?? 300}/month</p>
          <p>🤖 AI per use: ₹{rates?.llmPerUse ?? 0.2}</p>
          <p>👤 Hire fee: ₹{rates?.hireFeeMonthly ?? 1899}/month (incl. ₹500 credits) · GST {(rates?.gst ?? 0.18) * 100}%</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Usage by employee</h2>
        {!billing?.employees?.length ? (
          <p className="py-4 text-sm text-gray-400">No calls yet — your employees' usage shows here.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {billing.employees.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-gray-400">{e.role}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{e.minutesUsed} min</p>
                  <p className="text-xs text-gray-400">₹{e.costInr}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
