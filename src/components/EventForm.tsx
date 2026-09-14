import { useRef, useState, type FormEvent } from 'react';
import { Info, Plus, Trash2, X } from 'lucide-react';
import type { DiscoveredEvent } from '../../shared/discovery';
import {
  defaultChecklist,
  platformLabels,
  purchaseChannelLabels,
  type EventRecord,
  type PlatformId,
  type PurchaseChannel,
  type Tier,
} from '../../shared/model';
import { parseLocalInstant } from '../../shared/rules';
import { Temporal } from '@js-temporal/polyfill';

const today = () => Temporal.Now.plainDateISO().toString();
export function EventForm({
  initial,
  seed,
  onSave,
  onLaunchApp,
  onClose,
}: {
  initial?: EventRecord;
  seed?: DiscoveredEvent;
  onSave: (event: EventRecord, startNow?: boolean) => Promise<void>;
  onLaunchApp: () => Promise<string>;
  onClose: () => void;
}) {
  const quickChoice = Boolean(
    !initial && seed?.platform === 'damai' && seed.title && seed.sourceUrl && seed.sessions?.length,
  );
  const [showAdvanced, setShowAdvanced] = useState(!quickChoice);
  const [title, setTitle] = useState(initial?.title ?? seed?.title ?? '');
  const [platform, setPlatform] = useState<PlatformId>(
    initial?.platform ?? seed?.platform ?? 'damai',
  );
  const [venue, setVenue] = useState(initial?.venue ?? seed?.venue ?? '');
  const [sessionLocal, setSessionLocal] = useState(
    initial?.sessionLocal ?? seed?.sessionLocal ?? '',
  );
  const sessions = initial?.sessions ?? seed?.sessions ?? [];
  const [timeZone, setTimeZone] = useState(
    initial?.timeZone ?? (seed && seed.platform !== 'damai' ? '' : 'Asia/Shanghai'),
  );
  const [currency, setCurrency] = useState(
    initial?.currency ?? seed?.currency ?? (seed && seed.platform !== 'damai' ? '' : 'CNY'),
  );
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const purchaseLimit = Math.min(
    20,
    Math.max(1, Number(seed?.ruleNote.match(/每笔订单最多购买\s*(\d{1,2})\s*张/)?.[1]) || 20),
  );
  const [owner, setOwner] = useState(initial?.owner ?? '本人');
  const [tiers, setTiers] = useState<Tier[]>(
    initial?.tiers ??
      (quickChoice || seed?.ticketOptions?.length ? [] : [{ label: '', unitPrice: null }]),
  );
  const availableTickets = seed?.ticketOptions ?? [];
  const [appLaunchMessage, setAppLaunchMessage] = useState('');
  const [eventUrl, setEventUrl] = useState(initial?.eventUrl ?? seed?.eventUrl ?? '');
  const [purchaseChannel, setPurchaseChannel] = useState<PurchaseChannel>(
    initial?.purchaseChannel ?? (seed?.appOnly ? 'app_required' : 'unknown'),
  );
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? seed?.sourceUrl ?? '');
  const [verifiedAt, setVerifiedAt] = useState(initial?.verifiedAt ?? today());
  const [ruleNote, setRuleNote] = useState(initial?.ruleNote ?? seed?.ruleNote ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const startAfterSave = useRef(false);

  function selectTicket(option: Tier) {
    const exists = tiers.some(
      (tier) => tier.label === option.label && tier.unitPrice === option.unitPrice,
    );
    const next = exists
      ? tiers.filter((tier) => tier.label !== option.label || tier.unitPrice !== option.unitPrice)
      : tiers.length < 80
        ? [...tiers, option]
        : tiers;
    setTiers(next);
  }

  function changeTierPrice(index: number, input: string) {
    const next = tiers.map((tier, position) =>
      position === index ? { ...tier, unitPrice: input === '' ? null : Number(input) } : tier,
    );
    setTiers(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      const firstSession = sessions[0]?.local ?? sessionLocal;
      const at = parseLocalInstant(firstSession, timeZone);
      const lastAt = parseLocalInstant(sessions.at(-1)?.local ?? firstSession, timeZone);
      const now = new Date().toISOString();
      await onSave(
        {
          id: initial?.id ?? crypto.randomUUID(),
          title: title.trim(),
          platform,
          venue: venue.trim(),
          sessionLocal: firstSession,
          sessions: sessions.length ? sessions : undefined,
          timeZone,
          sessionAt: at,
          currency: currency.trim().toUpperCase(),
          quantity,
          budget: null,
          owner: owner.trim(),
          tiers: tiers.map((t) => ({ label: t.label.trim(), unitPrice: t.unitPrice })),
          eventUrl: eventUrl.trim(),
          purchaseChannel,
          sourceUrl: sourceUrl.trim(),
          verifiedAt,
          ruleNote: ruleNote.trim(),
          opportunities: initial?.opportunities ?? [],
          checklist: initial?.checklist ?? defaultChecklist(),
          attempts: initial?.attempts ?? [],
          followUntil:
            !initial || initial.followUntil === initial.sessionAt || initial.followUntil > lastAt
              ? lastAt
              : initial.followUntil,
          createdAt: initial?.createdAt ?? now,
          updatedAt: now,
        },
        startAfterSave.current,
      );
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
            <span className="eyebrow">
              {quickChoice && !availableTickets.length ? '官方入口' : '购票意向'}
            </span>
            <h2 id="event-form-title">
              {initial
                ? '编辑任务'
                : quickChoice && !availableTickets.length
                  ? '查看官方票档'
                  : '创建购票任务'}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </div>
        {seed && (
          <div className="import-summary" role="status">
            <Info size={18} />
            <div>
              <strong>已从{platformLabels[seed.platform]}公开页面带入活动信息</strong>
              <p>
                页面日期：{seed.dateHint || '未显示明确日期'}。
                {seed.appOnly ? '该项目提示在大麦 App 下单。' : '购票渠道仍需核对。'}
                {seed.sessions?.length ? ` 发现 ${seed.sessions.length} 个候选场次。` : ''}
                {seed.ticketOptions?.length
                  ? ` 发现 ${seed.ticketOptions.length} 个明确标价的票档。`
                  : ''}
                {availableTickets.length
                  ? '请从下方核对场次，选择票档和人数。'
                  : '本页没有可核实的逐档票价，请在原平台查看。'}
              </p>
            </div>
          </div>
        )}
        <form
          onSubmit={submit}
          className={`form-grid${quickChoice ? ' quick-form' : ''}${showAdvanced ? ' show-advanced' : ''}`}
        >
          {sessions.length ? (
            <fieldset className="wide candidate-picker">
              <legend>
                {quickChoice && !availableTickets.length ? '官方页面列出' : '已纳入全部'}{' '}
                {sessions.length} 个演出场次
              </legend>
              <div className="candidate-list" role="list" aria-label="已确认演出场次">
                {sessions.map((session) => (
                  <span className="candidate-choice" role="listitem" key={session.local}>
                    {session.label}
                  </span>
                ))}
              </div>
              <small>
                {quickChoice && !availableTickets.length
                  ? '这是公开页面列出的日期与时间，进入原生 App 后请再次核对场次与票档。'
                  : '任务包含当前官方页面明确列出的全部日期与时间。页面更新时请重新核对；同一票档在不同场次是否有售，以手机 App 为准。'}
              </small>
            </fieldset>
          ) : null}
          {!initial && seed && !availableTickets.length ? (
            <p className="wide candidate-warning" role="status">
              {seed.priceRange ? `页面只公开价格范围 ${seed.priceRange}，` : '页面没有公开票档，'}
              没有可核实的逐档名称和单价。请在官方购票入口查看实际票档；这里不会凭范围生成选项。
            </p>
          ) : null}
          {!initial && availableTickets.length ? (
            <fieldset className="wide candidate-picker">
              <legend>选择可接受票档</legend>
              <div className="candidate-list">
                {availableTickets.map((option) => {
                  const selectedIndex = tiers.findIndex(
                    (tier) => tier.label === option.label && tier.unitPrice === option.unitPrice,
                  );
                  const selected = selectedIndex >= 0;
                  return (
                    <button
                      type="button"
                      className={`candidate-ticket${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      disabled={!selected && tiers.length >= 80}
                      key={`${option.label}-${option.unitPrice}`}
                      onClick={() => selectTicket(option)}
                    >
                      {selected && <em className="candidate-rank">{selectedIndex + 1}</em>}
                      <span>{option.label}</span>
                      <strong>
                        {option.unitPrice?.toLocaleString()} {currency || '币种待核对'} / 张
                      </strong>
                    </button>
                  );
                })}
              </div>
              <small>按点击顺序排列偏好，先选的票档优先。页面价格可能不含手续费。</small>
            </fieldset>
          ) : null}
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
          {!sessions.length && (
            <label>
              固定演出场次（当地时间）
              <input
                required
                type="datetime-local"
                value={sessionLocal}
                onChange={(e) => setSessionLocal(e.target.value)}
              />
            </label>
          )}
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
          {(!quickChoice || availableTickets.length > 0) && (
            <label className="quick-field">
              固定人数
              {seed && !initial ? (
                <select
                  aria-label="固定人数"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                >
                  {Array.from({ length: purchaseLimit }, (_, index) => index + 1).map((count) => (
                    <option value={count} key={count}>
                      {count} 人
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="number"
                  min="1"
                  max="20"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              )}
            </label>
          )}
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
          {(!quickChoice || availableTickets.length > 0) && (
            <div className="wide tier-editor">
              <div className="section-title">
                <strong>可接受票档 · 由上到下优先</strong>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setTiers([...tiers, { label: '', unitPrice: null }])}
                  disabled={tiers.length >= 80}
                >
                  <Plus size={15} /> 添加票档
                </button>
              </div>
              {tiers.map((tier, i) => (
                <div className="tier-input" key={i}>
                  <span className="tier-letter">{i + 1}</span>
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
                    onChange={(e) => changeTierPrice(i, e.target.value)}
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
              <small>
                参考价不一定包含手续费；最终在官方结算页确认总金额。大麦本项目不支持自主选座时，只能选择官方展示的票档。
              </small>
            </div>
          )}
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
            本场购票渠道
            <select
              aria-label="本场购票渠道"
              value={purchaseChannel}
              onChange={(e) => setPurchaseChannel(e.target.value as PurchaseChannel)}
            >
              {Object.entries(purchaseChannelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>
              以当前项目官方须知为准；“仅官方 App”会优先打开原生 App，不把网页链接当成购票入口。
            </small>
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
          {quickChoice && availableTickets.length > 0 && (
            <div className="wide quick-form-toggle">
              <button
                type="button"
                className="text-button"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                {showAdvanced ? '收起详细资料' : '查看识别详情与手动修改'}
              </button>
            </div>
          )}
          {error && (
            <p className="form-error wide" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions wide">
            {quickChoice && (
              <small className="purchase-handoff-note" role="status">
                {appLaunchMessage ||
                  (availableTickets.length
                    ? '打开官方入口；票档、场次、实名和付款请在原平台确认。'
                    : '公开页面没有逐档票价；请在原生 App 查看并购票。')}
              </small>
            )}
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            {(!quickChoice || availableTickets.length > 0) && (
              <button
                type="submit"
                className={quickChoice ? 'button ghost' : 'button primary'}
                onClick={() => {
                  startAfterSave.current = false;
                }}
                disabled={busy || (quickChoice && !tiers.some((tier) => tier.label.trim()))}
              >
                {busy ? '保存中…' : '保存任务'}
              </button>
            )}
            {quickChoice && availableTickets.length > 0 && (
              <button
                type="submit"
                className="button primary"
                onClick={() => {
                  startAfterSave.current = true;
                }}
                disabled={busy || !tiers.some((tier) => tier.label.trim())}
              >
                {busy ? '打开中…' : '开始购票'}
              </button>
            )}
            {quickChoice && !availableTickets.length && seed?.appOnly && (
              <button
                type="button"
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setAppLaunchMessage(await onLaunchApp());
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? '打开中…' : '打开大麦 App 查看票档'}
              </button>
            )}
            {quickChoice && !availableTickets.length && !seed?.appOnly && (
              <button type="button" className="button primary" onClick={onClose}>
                返回官方网页查看票档
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
