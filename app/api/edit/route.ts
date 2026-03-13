import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return NextResponse.json({ error: 'REPLICATE_API_TOKEN 없음' }, { status: 500 });

  const body = await req.json();

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Token ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: body }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.detail || `HTTP ${createRes.status}` }, { status: createRes.status });
  }

  const prediction = await createRes.json();
  return NextResponse.json({ id: prediction.id, status: prediction.status });
}
