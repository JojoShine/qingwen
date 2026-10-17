'use client';
import { withBasePath } from '@/lib/paths';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import { App, Avatar, Button, Drawer, Dropdown } from 'antd';
import { AppstoreOutlined, TeamOutlined, SettingOutlined, LogoutOutlined, DownOutlined, MenuOutlined } from '@ant-design/icons';
import { api } from '@/lib/client';
import { requestLeave } from '@/lib/use-unsaved-changes';
export type CurrentUser = { id: string; username: string; name: string; role: string; active: boolean; isDemo: boolean };
const UserContext = createContext<CurrentUser | null>(null);
export const useUser = () => useContext(UserContext)!;
export function Brand({ compact = false }: { compact?: boolean }) { return <Link href="/surveys" className="brand"><span className="brand-mark"><i/><i/><i/></span><span>轻问<span className="brand-dot">.</span></span>{!compact && <span className="brand-en">QINGWEN</span>}</Link>; }
export default function Shell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname(); const [open, setOpen] = useState(false); const { message } = App.useApp();
  const editor = pathname.endsWith('/edit');
  const nav = <><Brand/><div className="workspace-label">工作空间 <span>个人版</span></div><nav className="side-nav"><Link onClick={() => setOpen(false)} className={pathname.startsWith('/surveys') ? 'active' : ''} href="/surveys"><AppstoreOutlined/> 我的问卷</Link>{user.role === 'ADMIN' && <Link onClick={() => setOpen(false)} className={pathname === '/users' ? 'active' : ''} href="/users"><TeamOutlined/> 用户管理</Link>}{!user.isDemo && <Link onClick={() => setOpen(false)} className={pathname === '/account' ? 'active' : ''} href="/account"><SettingOutlined/> 个人设置</Link>}</nav><div className="sidebar-bottom"><div className="side-note"><strong>让提问更简单</strong><p>收集声音，看见答案。</p></div><div className="workspace-status"><span className="status-dot"/> 专属问卷工作空间</div><div className="sidebar-copyright">轻问 QINGWEN</div></div></>;
  return <UserContext.Provider value={user}><div className={'dashboard ' + (editor ? 'is-editor' : '')}><aside className="sidebar">{nav}</aside><Drawer placement="left" open={open} onClose={() => setOpen(false)} styles={{ body: { padding: 24 } }} size={250}>{nav}</Drawer><div className="dashboard-body"><header className="topbar"><div className="topbar-left"><Button className="mobile-menu" type="text" icon={<MenuOutlined/>} onClick={() => setOpen(true)} aria-label="打开导航"/><span>工作空间</span><span className="breadcrumb-divider">/</span><strong>{pathname === '/users' ? '用户管理' : pathname === '/account' ? '个人设置' : editor ? '问卷编辑' : pathname.endsWith('/results') ? '数据与结果' : '我的问卷'}</strong></div><div className="topbar-right"><Dropdown trigger={['click']} menu={{ items: [...(!user.isDemo ? [{ key: 'account', label: <Link href="/account">个人设置</Link>, icon: <SettingOutlined/> }, { type: 'divider' as const }] : []), { key: 'logout', label: '退出登录', icon: <LogoutOutlined/>, onClick: () => requestLeave(async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); window.location.assign(withBasePath('/login')); } catch(e) { message.error((e as Error).message); } }) }] }}><button className="user-menu" aria-label="用户菜单"><Avatar size={32} style={{ background: '#e2f1ed', color: '#14796d', fontWeight: 600 }}>{user.name.slice(0,1)}</Avatar><span>{user.name}</span><DownOutlined style={{ fontSize: 10 }}/></button></Dropdown></div></header><main className="main-content">{children}</main></div></div></UserContext.Provider>;
}
