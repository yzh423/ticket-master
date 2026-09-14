import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { damaiDiscoveryUrl } from '../../shared/discovery';
import './discover.css';

const accountUrl = 'https://passport.damai.cn/accountinfo/myinfo';

export function DiscoverPage({ web }: { web: boolean }) {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const directLink = /^https?:/i.test(input.trim());

  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setBusy(true);
    try {
      damaiDiscoveryUrl(input);
      await window.ticket.discover(input);
      setMessage(
        web
          ? '已在新标签页打开大麦。网页版本无法读取另一个网站的活动内容，请使用 Windows 桌面版自动填入。'
          : '已打开大麦官方页面。进入具体活动后，候票台会读取公开信息供你核对。',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法打开大麦搜索');
    } finally {
      setBusy(false);
    }
  }

  async function openAccount() {
    try {
      await window.ticket.openOfficial('damai', accountUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法打开大麦账户入口');
    }
  }

  async function openPhone() {
    try {
      setDeviceMessage(await window.ticket.launchDamai());
    } catch (error) {
      setDeviceMessage(error instanceof Error ? error.message : '无法打开手机大麦');
    }
  }

  return (
    <div className="discover-page">
      <section className="discover-hero">
        <div className="discover-hero-copy">
          <span className="eyebrow">FIND YOUR EVENT / 大麦优先</span>
          <h1>搜索你想看的演出</h1>
          <p>
            输入歌手、活动名或粘贴大麦项目链接。从官方页面带入标题、演出日期与场馆，再核对你的固定场次。
          </p>
          <form className="discover-search" onSubmit={(event) => void search(event)}>
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="演出关键词或大麦链接"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如：邓紫棋 深圳 / https://detail.damai.cn/item.htm?id=…"
              autoFocus
            />
            <button type="submit" disabled={busy}>
              {busy ? '打开中…' : directLink ? '打开大麦活动' : '在大麦搜索'}{' '}
              <ArrowRight size={16} />
            </button>
          </form>
          {message && (
            <p className="discover-message" role="status">
              {message}
            </p>
          )}
          <div className="discover-trust">
            <ShieldCheck size={15} /> 只打开大麦官方域名 · 搜索验证码由你在官方页面完成
          </div>
        </div>
        <div className="discover-flow" aria-label="快速开始步骤">
          <span>
            01 <strong>搜索活动</strong>
          </span>
          <span>
            02 <strong>选中官方项目</strong>
          </span>
          <span>
            03 <strong>核对条件并保存</strong>
          </span>
        </div>
      </section>

      <div className="discover-section-heading">
        <div>
          <span className="eyebrow">BE READY</span>
          <h2>开售前一次准备好</h2>
        </div>
        <p>账号和实名资料留在大麦，不在候票台保存密码或证件号码。</p>
      </div>
      <div className="discover-prep-grid">
        <article>
          <div className="discover-prep-icon">
            <Link2 size={19} />
          </div>
          <span className="discover-prep-step">ACCOUNT</span>
          <h3>登录正确账号</h3>
          <p>
            在大麦官方页面自行登录。系统浏览器与候票台内置网页的登录会话不共享；请在实际购票的浏览器或手机
            App 中确认账号。
          </p>
          <button className="text-button" onClick={() => void openAccount()}>
            在系统浏览器打开账号页 <ExternalLink size={15} />
          </button>
        </article>
        <article>
          <div className="discover-prep-icon">
            <Users size={19} />
          </div>
          <span className="discover-prep-step">ATTENDEES</span>
          <h3>登记观演人</h3>
          <p>在大麦 App 的个人中心添加并核对本场要用的实名观演人；人数须与购票任务一致。</p>
          <button className="text-button" onClick={() => void openPhone()} disabled={web}>
            尝试打开手机大麦 <Smartphone size={15} />
          </button>
          {deviceMessage && <small role="status">{deviceMessage}</small>}
        </article>
      </div>
      <p className="discover-footnote">
        大麦搜索可能出现验证码，候票台不会绕过。公开页面可能只给出演出日期范围；固定场次、票档、人数和预算需由你确认后才会保存。
      </p>
    </div>
  );
}
