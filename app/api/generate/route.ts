import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await req.json();

  // 1. Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/models/google/nano-banana-2/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({ input: body }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.detail || `Replicate 오류: HTTP ${createRes.status}` }, { status: createRes.status });
  }

  let prediction = await createRes.json();

  // 2. Poll until done
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise(r => setTimeout(r, 1500));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Token ${apiToken}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    return NextResponse.json({ error: prediction.error || '생성 실패' }, { status: 500 });
  }

  return NextResponse.json({ output: prediction.output });
}
