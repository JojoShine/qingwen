import Link from 'next/link';
export default function NotFound(){return <div style={{padding:'15vh 25px',textAlign:'center'}}><h1>页面不在这里</h1><p style={{color:'#9aaa9d'}}>链接可能已失效，返回工作台继续探索吧。</p><Link href="/surveys" style={{color:'#168878'}}>返回工作台</Link></div>;}
