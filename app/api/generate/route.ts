import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await req.json();

  // prediction 생성만 하고 ID 반환 (폴링은 프론트에서)
  const createRes = await fetch('https://api.replicate.com/v1/models/google/nano-banana-2/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: body }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.detail || `Replicate 오류: HTTP ${createRes.status}` }, { status: createRes.status });
  }

  const prediction = await createRes.json();
  return NextResponse.json({ id: prediction.id, status: prediction.status });
}
