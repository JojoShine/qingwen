'use client';
import { useCallback, useEffect } from 'react';
import { App, Button } from 'antd';
import { useRouter } from 'next/navigation';

export function requestLeave(proceed: () => void) {
  if (window.dispatchEvent(new CustomEvent('qingwen:beforeleave', { cancelable: true, detail: { proceed } }))) proceed();
}
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const { modal } = App.useApp(); const router = useRouter();
  const leave = useCallback((proceed: () => void) => {
    if (!dirty) { proceed(); return; }
    const dialog = modal.confirm({
      title: '还有未保存的更改', content: '保存本次修改后离开，或放弃这些更改。', okText: '保存并离开', cancelText: '继续编辑',
      onOk: async () => { if (!await save()) throw new Error('保存失败'); proceed(); },
      footer: (_, { OkBtn, CancelBtn }) => <><Button danger type="text" onClick={() => { dialog.destroy(); proceed(); }}>放弃更改</Button><CancelBtn/><OkBtn/></>,
    });
  }, [dirty, save, modal]);
  useEffect(() => {
    if (!dirty) return;
    const currentUrl = window.location.href, editorHistory = window.history.state;
    const navigate = (url: string) => leave(() => { const destination = new URL(url); router.push(destination.pathname + destination.search + destination.hash); });
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const target = new URL(anchor.href, currentUrl);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      event.preventDefault(); event.stopPropagation(); navigate(target.href);
    };
    const back = (event: PopStateEvent) => {
      const target = window.location.href;
      if (target === currentUrl) return;
      event.stopImmediatePropagation();
      window.history.pushState(editorHistory, '', currentUrl);
      navigate(target);
    };
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const change = event as Event & { navigationType: string; canIntercept: boolean; destination: { url: string } };
      if (change.navigationType !== 'traverse' || !change.canIntercept || !event.cancelable || change.destination.url === currentUrl) return;
      event.preventDefault(); navigate(change.destination.url);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const custom = (event: Event) => { event.preventDefault(); leave((event as CustomEvent<{ proceed: () => void }>).detail.proceed); };
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', back, true);
    navigation?.addEventListener('navigate', traverse);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('qingwen:beforeleave', custom);
    return () => { document.removeEventListener('click', click, true); window.removeEventListener('popstate', back, true); navigation?.removeEventListener('navigate', traverse); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('qingwen:beforeleave', custom); };
  }, [dirty, leave, router]);
  return leave;
}
