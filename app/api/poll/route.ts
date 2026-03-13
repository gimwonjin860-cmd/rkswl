import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  const id = req.nextUrl.searchParams.get('id');

  if (!apiToken) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  if (!id) {
    return NextResponse.json({ error: 'id가 없습니다.' }, { status: 400 });
  }

  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Token ${apiToken}` },
  });

  const prediction = await res.json();
  return NextResponse.json({ status: prediction.status, output: prediction.output, error: prediction.error });
}
