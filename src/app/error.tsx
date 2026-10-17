'use client';
import { Button, Result } from 'antd';
export default function ErrorPage({reset}:{reset:()=>void}){return <Result status="error" title="页面暂时无法加载" subTitle="请确认数据库已启动，或稍后重试。" extra={<Button type="primary" onClick={reset}>重新加载</Button>}/>;}
