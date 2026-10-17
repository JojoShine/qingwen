'use client';
import { withBasePath } from '@/lib/paths';
import { useRef, useState } from 'react';
import { App, Button, Divider, Form, Input, type InputRef } from 'antd';
import { ArrowRightOutlined, LockOutlined, UserOutlined, GithubOutlined } from '@ant-design/icons';
import { api } from '@/lib/client';
import { Brand } from '@/components/shell';
import styles from './login-form.module.css';

export default function LoginForm({ demo }: { demo: { username: string; password: string } | null }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const passwordInput = useRef<InputRef>(null);
  async function submit(values: { username: string; password: string }) {
    setLoading(true);
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify(values) });
      window.location.assign(withBasePath('/surveys'));
    } catch(e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  }
  return <div className={styles.page}>
    <header className={styles.header}><Brand/></header>
    <main className={styles.main}>
      <div className={styles.content}>
        <div className={styles.intro}>
          <span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>
          <h1>登录轻问</h1>
          <p>从一个好问题开始。</p>
        </div>
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} className={styles.form}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined/>} placeholder="请输入你的账号" autoComplete="username" size="large" maxLength={40}/>
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password ref={passwordInput} prefix={<LockOutlined/>} placeholder="请输入密码" autoComplete="current-password" size="large" maxLength={128}/>
          </Form.Item>
          <Button className={styles.submit} type="primary" htmlType="submit" size="large" block loading={loading}>登录工作台 <ArrowRightOutlined/></Button>
        </Form>
        {demo && <aside className={styles.demo} aria-label="体验账号">
          <Divider plain>先体验一下</Divider>
          <Button className={styles.demoButton} size="large" block onClick={() => { form.setFieldsValue(demo); passwordInput.current?.focus({ cursor: 'end' }); }}>填入体验账号 <ArrowRightOutlined/></Button>
          <p>公共体验环境，请勿填写敏感信息。</p>
        </aside>}
        <p className={styles.help}>账号由管理员创建与维护</p>
        <div className={styles.attribution}>
          <span>Powered by <a href="https://tbtparent.me" target="_blank" rel="noopener noreferrer">TBTparent</a></span>
          <span className={styles.divider} aria-hidden="true"/>
          <a className={styles.github} href="https://github.com/JojoShine/qingwen" target="_blank" rel="noopener noreferrer" aria-label="GitHub 项目源码" title="GitHub 项目源码"><GithubOutlined/></a>
        </div>
      </div>
    </main>
    <footer className={styles.footer}>© {new Date().getFullYear()} 轻问</footer>
  </div>;
}
