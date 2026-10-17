import Results from '@/components/results';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <Results id={(await params).id}/>; }
