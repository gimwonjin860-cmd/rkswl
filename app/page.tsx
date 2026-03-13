'use client';

import { useState, useRef, useCallback } from 'react';

type Status = 'idle' | 'loading' | 'done' | 'error';

interface UploadedImage {
  id: number;
  name: string;
  base64: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--white)', border: 'none',
  borderRadius: 20, padding: '14px 16px',
  fontSize: 14, color: 'var(--black)',
  lineHeight: 1.6, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  transition: 'box-shadow 0.2s',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 12, color: 'var(--gray-4)' }}>{label}</div>
      {children}
    </div>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--gray-4)', pointerEvents: 'none' }}>▾</span>
    </div>
  );
}

function TogglePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: active ? 'var(--black)' : 'var(--white)',
      borderRadius: 50, padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
      fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 12,
      color: active ? 'var(--white)' : 'var(--gray-4)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)', transition: 'all 0.2s',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#66FF99' : 'var(--gray-2)', flexShrink: 0, transition: 'background 0.2s', display: 'inline-block' }} />
      {children}
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  const [outputFormat, setOutputFormat] = useState('jpg');
  const [googleSearch, setGoogleSearch] = useState(false);
  const [imageSearch, setImageSearch] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [statusText, setStatusText] = useState('대기 중');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImages = useCallback((files: FileList | null) => {
    if (!files) return;
    const toAdd = Array.from(files).slice(0, 14 - uploadedImages.length);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setUploadedImages(prev => [...prev, { id: Date.now() + Math.random(), name: file.name, base64: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedImages.length]);

  const removeImage = (id: number) => setUploadedImages(prev => prev.filter(i => i.id !== id));

  const toggleImageSearch = (val: boolean) => {
    setImageSearch(val);
    if (val) setGoogleSearch(true);
  };

  const generate = async () => {
    if (!prompt.trim()) { alert('프롬프트를 입력해주세요!'); return; }
    setStatus('loading'); setStatusText('이미지 생성 중...');
    setError(null); setOutputUrl(null);
    const startTime = Date.now();
    const input: Record<string, unknown> = {
      prompt, aspect_ratio: aspectRatio, resolution,
      output_format: outputFormat, google_search: googleSearch, image_search: imageSearch,
    };
    if (uploadedImages.length > 0) input.image_input = uploadedImages.map(img => img.base64);

    try {
      // 1. prediction 생성
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const predictionId = data.id;

      // 2. 프론트에서 폴링
      let output = null;
      while (!output) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/poll?id=${predictionId}`);
        const pollData = await pollRes.json();

        if (pollData.status === 'succeeded') {
          output = pollData.output;
        } else if (pollData.status === 'failed' || pollData.status === 'canceled') {
          throw new Error(pollData.error || '생성 실패');
        }
      }

      setOutputUrl(output);
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
      setStatus('done'); setStatusText('생성 완료!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg); setStatus('error'); setStatusText('오류 발생');
    }
  };

  const dotColor: Record<Status, string> = { idle: '#DCDCDC', loading: '#FFB800', done: '#22c55e', error: '#ef4444' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Noto+Sans+KR:wght@300;400;500&display=swap');
        :root { --black:#0D0D0D; --white:#FAFAFA; --gray-1:#F0F0F0; --gray-2:#DCDCDC; --gray-3:#ABABAB; --gray-4:#6B6B6B; }
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:var(--white);color:var(--black);font-family:'Noto Sans KR',sans-serif;font-weight:300;min-height:100vh;}
        input,textarea,select,button{font-family:inherit;}
        textarea{resize:none;}
        input:focus,textarea:focus,select:focus{outline:none;box-shadow:0 8px 32px rgba(0,0,0,0.14),0 0 0 2.5px var(--black)!important;}
        @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.7);opacity:0.5}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes imgReveal{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        .gen-btn:hover:not(:disabled){transform:scale(1.02);box-shadow:0 8px 28px rgba(0,0,0,0.25);}
        .gen-btn:active:not(:disabled){transform:scale(0.98);}
        .dl-btn:hover{transform:scale(1.04);box-shadow:0 4px 14px rgba(0,0,0,0.2);}
        @media(max-width:860px){.main-grid{grid-template-columns:1fr!important;}}
      `}</style>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh' }}>

        {/* HEADER */}
        <header style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 28px', background:'var(--black)', borderRadius:36, color:'var(--white)', animation:'slideDown 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ background:'var(--white)', color:'var(--black)', borderRadius:50, padding:'6px 14px', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, flexShrink:0 }}>NB2</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:22, letterSpacing:-0.5, flex:1 }}>나노바나나 2</div>
          <div style={{ fontSize:11, color:'var(--gray-3)', fontFamily:'Syne,sans-serif' }}>Gemini 3.1 Flash Image · Replicate</div>
        </header>

        {/* GRID */}
        <div className="main-grid" style={{ display:'grid', gridTemplateColumns:'clamp(340px,38%,440px) 1fr', gap:20, flex:1 }}>

          {/* INPUT */}
          <div style={{ background:'var(--gray-1)', borderRadius:36, padding:28, display:'flex', flexDirection:'column', gap:18, animation:'fadeUp 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'var(--gray-4)' }}>입력</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:30, letterSpacing:-1.5, lineHeight:1, marginTop:-4 }}>프롬프트</div>

            <Field label="프롬프트">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder={'생성하고 싶은 이미지를 자세히 설명해주세요...\n예: A serene Japanese garden at golden hour'}
                style={{ ...inputStyle, height: 120 }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate(); }}
              />
            </Field>

            <Field label="참조 이미지 (선택 · 최대 14장)">
              <div
                style={{ border:`2px dashed ${isDragging ? 'var(--black)' : 'var(--gray-2)'}`, borderRadius:28, padding:16, textAlign:'center', cursor:'pointer', background:'var(--white)', minHeight:76, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:6, fontSize:13, color:'var(--gray-3)', transition:'border-color 0.2s' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleImages(e.dataTransfer.files); }}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => handleImages(e.target.files)} />
                <span style={{ fontSize:20 }}>🖼️</span>
                {uploadedImages.length === 0
                  ? <span>클릭하거나 드래그해서 이미지 추가</span>
                  : <span style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, color:'var(--gray-4)' }}>+ 더 추가 ({uploadedImages.length}/14)</span>}
              </div>
              {uploadedImages.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
                  {uploadedImages.map(img => (
                    <div key={img.id} style={{ position:'relative', width:56, height:56, borderRadius:12, overflow:'hidden', flexShrink:0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.base64} alt={img.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <button onClick={() => removeImage(img.id)} style={{ position:'absolute', top:2, right:2, background:'var(--black)', color:'var(--white)', border:'none', borderRadius:'50%', width:16, height:16, fontSize:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="비율">
                <SelectWrap>
                  <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:13, paddingRight:36, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['1:1','16:9','9:16','4:3','3:4','4:1','match_input_image'].map(v => <option key={v} value={v}>{v === 'match_input_image' ? '입력 이미지 기준' : v}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="해상도">
                <SelectWrap>
                  <select value={resolution} onChange={e => setResolution(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:13, paddingRight:36, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['1K','2K','4K'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="출력 포맷">
                <SelectWrap>
                  <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:13, paddingRight:36, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['jpg','png','webp'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                  </select>
                </SelectWrap>
              </Field>
            </div>

            <Field label="검색 그라운딩">
              <div style={{ display:'flex', gap:10 }}>
                <TogglePill active={googleSearch} onClick={() => setGoogleSearch(v => !v)}>🌐 웹 검색</TogglePill>
                <TogglePill active={imageSearch} onClick={() => toggleImageSearch(!imageSearch)}>🖼️ 이미지 검색</TogglePill>
              </div>
            </Field>

            <button className="gen-btn" onClick={generate} disabled={status === 'loading'} style={{ width:'100%', padding:18, background:status==='loading'?'var(--gray-2)':'var(--black)', color:status==='loading'?'var(--gray-3)':'var(--white)', border:'none', borderRadius:28, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16, cursor:status==='loading'?'not-allowed':'pointer', transition:'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', marginTop:'auto' }}>
              {status === 'loading' ? '⏳ 생성 중...' : '✦ 이미지 생성하기'}
            </button>
          </div>

          {/* OUTPUT */}
          <div style={{ background:'var(--gray-1)', borderRadius:36, padding:28, display:'flex', flexDirection:'column', gap:18, animation:'fadeUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.06s both' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'var(--gray-4)' }}>출력</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:30, letterSpacing:-1.5, lineHeight:1, marginTop:4 }}>결과 이미지</div>
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:50, background:'var(--white)', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, color:'var(--gray-4)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor[status], flexShrink:0, animation:status==='loading'?'pulse 1s ease-in-out infinite':'none', display:'inline-block' }} />
                {statusText}
              </div>
            </div>

            <div style={{ flex:1, background:'var(--white)', borderRadius:28, display:'flex', alignItems:'center', justifyContent:'center', minHeight:400, position:'relative', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
              {status === 'loading' && (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, background:'rgba(250,250,250,0.92)', borderRadius:28 }}>
                  <div style={{ width:44, height:44, border:'3px solid var(--gray-2)', borderTopColor:'var(--black)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:13, color:'var(--gray-4)' }}>나노바나나2 생성 중...</div>
                </div>
              )}
              {outputUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={outputUrl} alt="Generated" style={{ width:'100%', height:'100%', objectFit:'contain', borderRadius:28, animation:'imgReveal 0.5s cubic-bezier(0.34,1.56,0.64,1)' }} />
                : status !== 'loading' && (
                  <div style={{ textAlign:'center', color:'var(--gray-3)' }}>
                    <span style={{ fontSize:48, display:'block', marginBottom:12, opacity:0.5 }}>🍌</span>
                    <p style={{ fontSize:14, lineHeight:1.7 }}>프롬프트를 입력하고<br/>생성하기를 눌러주세요</p>
                  </div>
                )}
            </div>

            {error && <div style={{ padding:'14px 18px', background:'#FFF0F0', borderRadius:20, fontSize:13, color:'#c0392b', fontFamily:'Syne,sans-serif', fontWeight:500 }}>⚠️ {error}</div>}

            {outputUrl && status === 'done' && (
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:8, flex:1, flexWrap:'wrap' }}>
                  {['google/nano-banana-2', elapsed ? `${elapsed}s` : '', aspectRatio, resolution].filter(Boolean).map((c, i) => (
                    <div key={i} style={{ padding:'6px 12px', background:'var(--white)', borderRadius:50, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, color:'var(--gray-4)', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>{c}</div>
                  ))}
                </div>
                <a className="dl-btn" href={outputUrl} target="_blank" rel="noreferrer" style={{ padding:'10px 18px', background:'var(--black)', color:'var(--white)', border:'none', borderRadius:50, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, transition:'all 0.2s' }}>⬇ 다운로드</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
