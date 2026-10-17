import 'dotenv/config';
import { db } from '../src/lib/db';
import { newQuestion, initialAnswers, type Question, type Answers } from '../src/lib/survey';
import { jsonValue } from '../src/lib/service';
async function main(){
  const owner=await db.user.findUnique({where:{username:process.env.ADMIN_USERNAME||'admin'}});
  if(!owner)throw new Error('请先创建管理员');
  const examples=[
    {title:'产品使用体验调研',description:'倾听你的真实体验，让每一次改进都有方向。',theme:'mint',status:'ACTIVE' as const,responses:24},
    {title:'秋日团队活动意向收集',description:'把期待告诉我们，一起创造值得记住的时刻。',theme:'warm',status:'ACTIVE' as const,responses:16},
    {title:'新员工入职体验反馈',description:'关于融入、成长与连接，我们想听听你的感受。',theme:'blue',status:'DRAFT' as const,responses:0},
    {title:'品牌与用户认知调研',description:'从你的视角出发，发现品牌的更多可能。',theme:'ink',status:'CLOSED' as const,responses:32},
    {title:'社区生活满意度调查',description:'让每一个微小的声音，共同构成更好的日常。',theme:'mint',status:'DRAFT' as const,responses:0},
  ];
  for(const [i,e] of examples.entries()){
    const title='【示例】'+e.title;
    if(await db.survey.findFirst({where:{ownerId:owner.id,title}}))continue;
    const section=newQuestion('section');section.title='关于你的体验';section.description='请根据最近一次真实体验作答。';
    const q=newQuestion('single');q.title='你对整体体验的评价是？';q.options.forEach((o,i)=>o.label=['非常满意','还可以'][i]);q.options.push({id:crypto.randomUUID(),label:'有待改进'});q.other=true;
    const rating=newQuestion('rating');rating.title='如果满分是 5 星，你会打几分？';
    const text=newQuestion('textarea');text.title='你希望我们在哪些方面做得更好？';text.required=false;
    const content:Question[]=[section,q,rating,text];
    const s=await db.survey.create({data:{ownerId:owner.id,title,description:e.description,banner:e.theme,background:e.theme,status:e.status,content:jsonValue(content),platform:i===3?'desktop':'mobile',publishedAt:e.status==='DRAFT'?null:new Date(Date.now()-(i+2)*86400000)}});
    if(e.responses)await db.response.createMany({data:Array.from({length:e.responses},(_,n)=>{
      const answers:Answers={...initialAnswers(content),[q.id]:{value:q.options[n%3===0?1:0].id},[rating.id]:{value:3+n%3},[text.id]:{value:['界面很舒服，希望增加更多模板。','操作很方便，整体体验不错。','期待更完善的使用引导。'][n%3]}};
      return {surveyId:s.id,submissionKey:crypto.randomUUID(),titleSnapshot:title,answers:jsonValue(answers),createdAt:new Date(Date.now()-(e.responses-n)*3600000)};
    })});
  }
  console.log('示例问卷已创建；标题均标注【示例】，不会混入自行创建的问卷。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
