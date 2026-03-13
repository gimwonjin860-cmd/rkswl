import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url 없음' }, { status: 400 });

  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: `fetch 실패: ${res.status}` }, { status: res.status });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return new NextResponse(buffer, { headers: { 'Content-Type': contentType } });
}
