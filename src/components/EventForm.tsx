import { useRef, useState, type FormEvent } from 'react';
import { Info, Plus, Trash2, X } from 'lucide-react';
import type { DiscoveredEvent } from '../../shared/discovery';
import {
  defaultChecklist,
  platformLabels,
  type EventRecord,
  type PlatformId,
  type Tier,
} from '../../shared/model';
import { parseLocalInstant } from '../../shared/rules';
import { Temporal } from '@js-temporal/polyfill';

const today = () => Temporal.Now.plainDateISO().toString();
export function EventForm({
  initial,
  seed,
  onSave,
  onClose,
}: {
  initial?: EventRecord;
  seed?: DiscoveredEvent;
  onSave: (event: EventRecord) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? seed?.title ?? '');
  const [platform, setPlatform] = useState<PlatformId>(
    initial?.platform ?? seed?.platform ?? 'damai',
  );
  const [venue, setVenue] = useState(initial?.venue ?? seed?.venue ?? '');
  const [sessionLocal, setSessionLocal] = useState(
    initial?.sessionLocal ?? seed?.sessionLocal ?? '',
  );
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? 'Asia/Shanghai');
  const [currency, setCurrency] = useState(initial?.currency ?? 'CNY');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [budget, setBudget] = useState<number | ''>(initial?.budget ?? (seed ? '' : 1000));
  const [owner, setOwner] = useState(initial?.owner ?? '本人');
  const [tiers, setTiers] = useState<Tier[]>(initial?.tiers ?? [{ label: '', unitPrice: null }]);
  const [eventUrl, setEventUrl] = useState(initial?.eventUrl ?? seed?.eventUrl ?? '');
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? seed?.sourceUrl ?? '');
  const [verifiedAt, setVerifiedAt] = useState(initial?.verifiedAt ?? today());
  const [ruleNote, setRuleNote] = useState(initial?.ruleNote ?? seed?.ruleNote ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      const at = parseLocalInstant(sessionLocal, timeZone);
      const now = new Date().toISOString();
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        title: title.trim(),
        platform,
        venue: venue.trim(),
        sessionLocal,
        timeZone,
        sessionAt: at,
        currency: currency.trim().toUpperCase(),
        quantity,
        budget: Number(budget),
        owner: owner.trim(),
        tiers: tiers.map((t) => ({ label: t.label.trim(), unitPrice: t.unitPrice })),
        eventUrl: eventUrl.trim(),
        sourceUrl: sourceUrl.trim(),
        verifiedAt,
        ruleNote: ruleNote.trim(),
        opportunities: initial?.opportunities ?? [],
        checklist: initial?.checklist ?? defaultChecklist(),
        attempts: initial?.attempts ?? [],
        followUntil:
          !initial || initial.followUntil === initial.sessionAt || initial.followUntil > at
            ? at
            : initial.followUntil,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请检查输入');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">购票意向</span>
            <h2 id="event-form-title">{initial ? '编辑任务' : '创建购票任务'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </div>
        {seed && (
          <div className="import-summary" role="status">
            <Info size={18} />
            <div>
              <strong>已从大麦公开页面带入活动信息</strong>
              <p>
                页面日期：{seed.dateHint || '未显示明确日期'}。
                {seed.appOnly ? '该项目提示在大麦 App 下单。' : '购票渠道仍需核对。'}
                请确认下方固定场次、所在地时区、人数、票档与总预算。
              </p>
            </div>
          </div>
        )}
        <form onSubmit={submit} className="form-grid">
          <label className="wide">
            活动名称
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：某某巡演 · 上海站"
              autoFocus
            />
          </label>
          <label>
            平台
            <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
              {Object.entries(platformLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            场馆 / 城市
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="上海 · 某体育馆"
            />
          </label>
          <label>
            固定演出场次（当地时间）
            <input
              required
              type="datetime-local"
              value={sessionLocal}
              onChange={(e) => setSessionLocal(e.target.value)}
            />
          </label>
          <label>
            活动所在地 IANA 时区
            <input
              required
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              list="timezones"
            />
            <datalist id="timezones">
              <option value="Asia/Shanghai" />
              <option value="Asia/Hong_Kong" />
              <option value="Asia/Tokyo" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
          </label>
          <label>
            固定人数
            <input
              required
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label>
            含费用的总预算
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <label>
            币种
            <input
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="CNY"
            />
          </label>
          <label>
            购买负责人
            <input
              value={owner}
              maxLength={60}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="只填写称呼，不填证件号"
            />
          </label>
          <div className="wide tier-editor">
            <div className="section-title">
              <strong>可接受票档 · 由上到下优先</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setTiers([...tiers, { label: '', unitPrice: null }])}
                disabled={tiers.length >= 8}
              >
                <Plus size={15} /> 添加票档
              </button>
            </div>
            {tiers.map((tier, i) => (
              <div className="tier-input" key={i}>
                <span className="tier-letter">{String.fromCharCode(65 + i)}</span>
                <input
                  aria-label={`票档 ${i + 1} 名称`}
                  required
                  value={tier.label}
                  placeholder="如 内场 / 看台"
                  onChange={(e) =>
                    setTiers(tiers.map((t, n) => (n === i ? { ...t, label: e.target.value } : t)))
                  }
                />
                <input
                  aria-label={`票档 ${i + 1} 单张参考价格`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.unitPrice ?? ''}
                  placeholder="单张价格（未知可空）"
                  onChange={(e) =>
                    setTiers(
                      tiers.map((t, n) =>
                        n === i
                          ? {
                              ...t,
                              unitPrice: e.target.value === '' ? null : Number(e.target.value),
                            }
                          : t,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`删除票档 ${i + 1}`}
                  disabled={tiers.length === 1}
                  onClick={() => setTiers(tiers.filter((_, n) => n !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <small>参考价不一定包含手续费；最终在官方结算页确认总金额。</small>
          </div>
          <label className="wide">
            官方购票网址（可暂空）
            <input
              type="url"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
              placeholder="https://detail.damai.cn/…"
            />
            <small>仅允许打开已验证的平台 HTTPS 域名；App 专属项目可留空。</small>
          </label>
          <label className="wide">
            项目规则来源 / 公告网址
            <input
              required
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="粘贴本场活动官方公告或商品页地址"
            />
          </label>
          <label>
            规则核实日期
            <input
              required
              type="date"
              value={verifiedAt}
              onChange={(e) => setVerifiedAt(e.target.value)}
            />
          </label>
          <label className="wide">
            本场规则摘录
            <textarea
              rows={3}
              value={ruleNote}
              onChange={(e) => setRuleNote(e.target.value)}
              placeholder="例如：仅 App 下单；实名观演人；每单限购 2 张……"
            />
          </label>
          {error && (
            <p className="form-error wide" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions wide">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? '保存中…' : '保存任务'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
