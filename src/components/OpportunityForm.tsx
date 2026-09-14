import { useMemo, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  saleLabels,
  purchaseChannelLabels,
  type EventRecord,
  type PurchaseChannel,
  type SaleOpportunity,
  type SaleType,
} from '../../shared/model';
import { formatLocalInstant, parseLocalInstant } from '../../shared/rules';
import { Temporal } from '@js-temporal/polyfill';
import { extractAnnouncementTimes } from '../../shared/announcement-import';

export function OpportunityForm({
  event,
  initial,
  onSave,
  onClose,
}: {
  event: EventRecord;
  initial?: SaleOpportunity;
  onSave: (value: SaleOpportunity) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<SaleType>(initial?.type ?? 'public');
  const [localTime, setLocalTime] = useState(initial?.localTime ?? '');
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? event.timeZone);
  const [endLocal, setEndLocal] = useState(
    initial?.endsAt ? formatLocalInstant(initial.endsAt, initial.timeZone) : '',
  );
  const [eligibility, setEligibility] = useState(initial?.eligibility ?? '');
  const [url, setUrl] = useState(initial?.url ?? event.eventUrl);
  const [purchaseChannel, setPurchaseChannel] = useState<PurchaseChannel | ''>(
    initial?.purchaseChannel ?? '',
  );
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? event.sourceUrl);
  const [verifiedAt, setVerifiedAt] = useState(
    initial?.verifiedAt ?? Temporal.Now.plainDateISO().toString(),
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [announcement, setAnnouncement] = useState('');
  const [candidateApplied, setCandidateApplied] = useState(false);
  const [candidateConfirmed, setCandidateConfirmed] = useState(false);
  const candidates = useMemo(
    () => extractAnnouncementTimes(announcement, timeZone),
    [announcement, timeZone],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (candidateApplied && !candidateConfirmed)
        throw new Error('请先在官方公告核对活动、开售时间、时区和来源，再确认保存');
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        type,
        localTime,
        timeZone,
        startsAt: parseLocalInstant(localTime, timeZone),
        endsAt: endLocal ? parseLocalInstant(endLocal, timeZone) : null,
        eligibility: eligibility.trim(),
        url: url.trim(),
        purchaseChannel: purchaseChannel || undefined,
        sourceUrl: sourceUrl.trim(),
        verifiedAt,
        status: initial?.status ?? 'planned',
        note: note.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
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
        className="dialog small-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-form-title"
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">销售日历</span>
            <h2 id="sale-form-title">{initial ? '编辑官方机会' : '添加官方机会'}</h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit} className="form-grid">
          <details className="announcement-import wide">
            <summary>粘贴公告，辅助提取时间</summary>
            <p>只识别含完整年份的日期和 24 小时时间。原文仅在本窗口本地分析，不会保存。</p>
            <label>
              官方公告文字
              <textarea
                rows={4}
                maxLength={10000}
                value={announcement}
                onChange={(e) => {
                  setAnnouncement(e.target.value);
                  setCandidateConfirmed(false);
                }}
                placeholder="例如：公开开售 2026年9月20日 12:00；演出 2026年10月1日 19:30"
              />
            </label>
            {announcement.trim() &&
              (candidates.length ? (
                <div className="announcement-candidates" role="group" aria-label="识别出的时间候选">
                  <small>识别到 {candidates.length} 个时间。请从原文判断哪一个是本轮开售：</small>
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.localTime}
                      type="button"
                      className={
                        localTime === candidate.localTime && candidateApplied ? 'selected' : ''
                      }
                      aria-pressed={localTime === candidate.localTime && candidateApplied}
                      onClick={() => {
                        setLocalTime(candidate.localTime);
                        setCandidateApplied(true);
                        setCandidateConfirmed(false);
                      }}
                    >
                      <strong>{candidate.localTime.replace('T', ' ')}</strong>
                      <span>{candidate.excerpt}</span>
                      {(event.sessions?.some((session) => session.local === candidate.localTime) ??
                        candidate.localTime === event.sessionLocal) && (
                        <em>与已录入的演出场次相同，请确认它是否真是开售时间。</em>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p role="status">
                  未识别到有效的完整日期与时间；请检查年份、24 小时制和时区，或手动填写。
                </p>
              ))}
          </details>
          <label>
            机会类型
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as SaleType);
                setCandidateConfirmed(false);
              }}
            >
              {Object.entries(saleLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            开始（所在地时间）
            <input
              required
              type="datetime-local"
              value={localTime}
              onChange={(e) => {
                setLocalTime(e.target.value);
                setCandidateConfirmed(false);
              }}
            />
          </label>
          <label>
            时区
            <input
              required
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                setCandidateConfirmed(false);
              }}
            />
          </label>
          <label>
            截止（选填，同一时区）
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => {
                setEndLocal(e.target.value);
                setCandidateConfirmed(false);
              }}
            />
          </label>
          <label className="wide">
            资格条件
            <input
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value)}
              placeholder="如会员预售、官方候补登记等"
            />
          </label>
          <label className="wide">
            官方入口
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setCandidateConfirmed(false);
              }}
              placeholder="平台官方 HTTPS 地址；App 入口可留空"
            />
          </label>
          <label className="wide">
            本次销售渠道
            <select
              aria-label="本次销售渠道"
              value={purchaseChannel}
              onChange={(e) => setPurchaseChannel(e.target.value as PurchaseChannel | '')}
            >
              <option value="">
                沿用任务设置（{purchaseChannelLabels[event.purchaseChannel ?? 'unknown']}）
              </option>
              {Object.entries(purchaseChannelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>预售、公开销售和补票可能使用不同渠道；请按这一次官方公告核对。</small>
          </label>
          <label className="wide">
            来源网址
            <input
              required
              type="url"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                setCandidateConfirmed(false);
              }}
            />
          </label>
          {candidateApplied && (
            <label className="announcement-review wide">
              <input
                type="checkbox"
                checked={candidateConfirmed}
                onChange={(e) => setCandidateConfirmed(e.target.checked)}
              />
              <span>我已在官方公告核对本场活动、开售时间、时区及来源</span>
            </label>
          )}
          <label>
            核实日期
            <input
              required
              type="date"
              value={verifiedAt}
              onChange={(e) => setVerifiedAt(e.target.value)}
            />
          </label>
          <label className="wide">
            备注
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录本场公告的适用规则，不猜测回流时间"
            />
          </label>
          {error && (
            <p role="alert" className="form-error wide">
              {error}
            </p>
          )}
          <div className="form-actions wide">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? '保存中…' : '保存机会'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
