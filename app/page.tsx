'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type Status = 'idle' | 'loading' | 'done' | 'error';
type Mode = 'generate' | 'edit';

interface UploadedImage { id: number; name: string; base64: string; }

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--white)', border: 'none',
  borderRadius: 20, padding: '14px 16px', fontSize: 14, color: 'var(--black)',
  lineHeight: 1.6, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', transition: 'box-shadow 0.2s',
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
  const [history, setHistory] = useState<string[]>([]); // 되돌리기 히스토리
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('generate');
  const [editPrompt, setEditPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [editedUrl, setEditedUrl] = useState<string | null>(null); // 편집 결과
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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
  const toggleImageSearch = (val: boolean) => { setImageSearch(val); if (val) setGoogleSearch(true); };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 80, 0, 0.6)';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasMask(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearMask = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  useEffect(() => {
    if (mode === 'edit' && outputUrl && canvasRef.current && imgRef.current) {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      const init = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        setHasMask(false);
        setEditedUrl(null);
      };
      if (img.complete) init(); else img.onload = init;
    }
  }, [mode, outputUrl]);

  const pollPrediction = async (predictionId: string): Promise<string> => {
    const maxAttempts = 200;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const res = await fetch(`/api/poll?id=${predictionId}`);
      const data = await res.json();
      if (data.status === 'succeeded') return data.output as string;
      if (data.status === 'failed' || data.status === 'canceled') throw new Error(data.error || '생성 실패');
    }
    throw new Error('시간 초과. 해상도를 낮춰보세요.');
  };

  const generate = async () => {
    if (!prompt.trim()) { alert('프롬프트를 입력해주세요!'); return; }
    setStatus('loading'); setStatusText('생성 중...'); setError(null); setOutputUrl(null); setMode('generate'); setHistory([]);
    const startTime = Date.now();
    const input: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio, resolution, output_format: outputFormat, google_search: googleSearch, image_search: imageSearch };
    if (uploadedImages.length > 0) input.image_input = uploadedImages.map(i => i.base64);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const output = await pollPrediction(data.id);
      setOutputUrl(output);
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
      setStatus('done'); setStatusText('생성 완료!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg); setStatus('error'); setStatusText('오류 발생');
    }
  };

  const applyEdit = async () => {
    if (!editPrompt.trim()) { alert('수정 지시를 입력해주세요!'); return; }
    if (!outputUrl) return;
    setStatus('loading'); setStatusText('수정 중...'); setError(null); setEditedUrl(null);
    const startTime = Date.now();
    try {
      const imgRes = await fetch(`/api/proxy?url=${encodeURIComponent(outputUrl)}`);
      const imgBlob = await imgRes.blob();
      const originalBase64 = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target!.result as string);
        reader.readAsDataURL(imgBlob);
      });

      // 마스크 생성: 칠한 부분=흰색, 나머지=검정
      const srcCanvas = canvasRef.current!;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = srcCanvas.width; maskCanvas.height = srcCanvas.height;
      const mctx = maskCanvas.getContext('2d')!;
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      if (hasMask) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = srcCanvas.width; tempCanvas.height = srcCanvas.height;
        const tctx = tempCanvas.getContext('2d')!;
        tctx.drawImage(srcCanvas, 0, 0);
        const imageData = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 10) { d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255; }
        }
        tctx.putImageData(imageData, 0, 0);
        mctx.drawImage(tempCanvas, 0, 0);
      }
      const maskBase64 = maskCanvas.toDataURL('image/png');

      const res = await fetch('/api/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: editPrompt, image: originalBase64, mask: maskBase64 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const output = await pollPrediction(data.id);

      // 히스토리에 이전 이미지 저장
      setHistory(prev => [...prev, outputUrl]);
      setOutputUrl(output);
      setEditedUrl(output);
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
      setStatus('done'); setStatusText('수정 완료!');
      clearMask(); setEditPrompt('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg); setStatus('error'); setStatusText('오류 발생');
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setOutputUrl(prev);
    setEditedUrl(null);
    clearMask();
  };

  const dotColor: Record<Status, string> = { idle: '#DCDCDC', loading: '#FFB800', done: '#22c55e', error: '#ef4444' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Noto+Sans+KR:wght@300;400;500&display=swap');
        :root { --black:#0D0D0D; --white:#FAFAFA; --gray-1:#F0F0F0; --gray-2:#DCDCDC; --gray-3:#ABABAB; --gray-4:#6B6B6B; }
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:var(--white);color:var(--black);font-family:'Noto Sans KR',sans-serif;font-weight:300;min-height:100vh;}
        input,textarea,select,button{font-family:inherit;} textarea{resize:none;}
        input:focus,textarea:focus,select:focus{outline:none;box-shadow:0 8px 32px rgba(0,0,0,0.14),0 0 0 2.5px var(--black)!important;}
        @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.7);opacity:0.5}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes imgReveal{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        .gen-btn:hover:not(:disabled){transform:scale(1.02);box-shadow:0 8px 28px rgba(0,0,0,0.25);}
        .gen-btn:active:not(:disabled){transform:scale(0.98);}
        .dl-btn:hover{transform:scale(1.04);}
        .edit-canvas{cursor:crosshair;touch-action:none;}
        @media(max-width:900px){.main-grid{grid-template-columns:1fr!important;}}
      `}</style>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100vh' }}>

        {/* HEADER */}
        <header style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 24px', background:'var(--black)', borderRadius:32, color:'var(--white)', animation:'slideDown 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ background:'var(--white)', color:'var(--black)', borderRadius:50, padding:'5px 12px', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:12 }}>NB2</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:20, flex:1 }}>나노바나나 2</div>
          <div style={{ fontSize:11, color:'var(--gray-3)', fontFamily:'Syne,sans-serif' }}>Gemini 3.1 Flash Image · Replicate</div>
        </header>

        <div className="main-grid" style={{ display:'grid', gridTemplateColumns:'clamp(300px,32%,400px) 1fr', gap:16, flex:1, alignItems:'start' }}>

          {/* INPUT PANEL */}
          <div style={{ background:'var(--gray-1)', borderRadius:32, padding:24, display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:-1 }}>프롬프트</div>

            <Field label="프롬프트">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder={'이미지를 설명해주세요...\n예: A serene Japanese garden at golden hour'}
                style={{ ...inputStyle, height: 90 }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate(); }}
              />
            </Field>

            <Field label="참조 이미지 (선택 · 최대 14장)">
              <div
                style={{ border:`2px dashed ${isDragging ? 'var(--black)' : 'var(--gray-2)'}`, borderRadius:24, padding:14, textAlign:'center', cursor:'pointer', background:'var(--white)', minHeight:64, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4, fontSize:12, color:'var(--gray-3)', transition:'border-color 0.2s' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleImages(e.dataTransfer.files); }}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => handleImages(e.target.files)} />
                {uploadedImages.length === 0 ? <><span style={{ fontSize:18 }}>🖼️</span><span>클릭 또는 드래그</span></>
                  : <span style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, color:'var(--gray-4)' }}>+ 더 추가 ({uploadedImages.length}/14)</span>}
              </div>
              {uploadedImages.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {uploadedImages.map(img => (
                    <div key={img.id} style={{ position:'relative', width:48, height:48, borderRadius:10, overflow:'hidden' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.base64} alt={img.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <button onClick={() => removeImage(img.id)} style={{ position:'absolute', top:1, right:1, background:'var(--black)', color:'var(--white)', border:'none', borderRadius:'50%', width:14, height:14, fontSize:7, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Field label="비율">
                <SelectWrap>
                  <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, paddingRight:32, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['1:1','16:9','9:16','4:3','3:4','4:1','match_input_image'].map(v => <option key={v} value={v}>{v === 'match_input_image' ? '입력 기준' : v}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="해상도">
                <SelectWrap>
                  <select value={resolution} onChange={e => setResolution(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, paddingRight:32, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['1K','2K'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="출력 포맷">
                <SelectWrap>
                  <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{ ...inputStyle, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, paddingRight:32, cursor:'pointer', WebkitAppearance:'none' as React.CSSProperties['WebkitAppearance'] }}>
                    {['jpg','png','webp'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                  </select>
                </SelectWrap>
              </Field>
            </div>

            <Field label="검색 그라운딩">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <TogglePill active={googleSearch} onClick={() => setGoogleSearch(v => !v)}>🌐 웹 검색</TogglePill>
                <TogglePill active={imageSearch} onClick={() => toggleImageSearch(!imageSearch)}>🖼️ 이미지 검색</TogglePill>
              </div>
            </Field>

            <button className="gen-btn" onClick={generate} disabled={status === 'loading'} style={{ width:'100%', padding:16, background:status==='loading'?'var(--gray-2)':'var(--black)', color:status==='loading'?'var(--gray-3)':'var(--white)', border:'none', borderRadius:24, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, cursor:status==='loading'?'not-allowed':'pointer', transition:'all 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
              {status === 'loading' && mode === 'generate' ? '⏳ 생성 중...' : '✦ 이미지 생성하기'}
            </button>
          </div>

          {/* OUTPUT PANEL */}
          <div style={{ background:'var(--gray-1)', borderRadius:32, padding:24, display:'flex', flexDirection:'column', gap:16 }}>

            {/* Top bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:-1 }}>결과 이미지</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {/* 되돌리기 버튼 */}
                {history.length > 0 && (
                  <button onClick={undo} style={{ padding:'7px 16px', borderRadius:50, border:'1.5px solid var(--gray-2)', background:'var(--white)', fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, cursor:'pointer', color:'var(--gray-4)', display:'flex', alignItems:'center', gap:6 }}>
                    ↩ 되돌리기 ({history.length})
                  </button>
                )}
                <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:50, background:'var(--white)', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:12, color:'var(--gray-4)' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor[status], flexShrink:0, animation:status==='loading'?'pulse 1s ease-in-out infinite':'none', display:'inline-block' }} />
                  {statusText}
                </div>
              </div>
            </div>

            {/* Mode tabs */}
            {outputUrl && status !== 'loading' && (
              <div style={{ display:'flex', gap:8 }}>
                {(['generate','edit'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding:'7px 16px', borderRadius:50, border:'none', cursor:'pointer',
                    fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12,
                    background: mode === m ? 'var(--black)' : 'var(--white)',
                    color: mode === m ? 'var(--white)' : 'var(--gray-4)',
                    boxShadow:'0 2px 12px rgba(0,0,0,0.08)', transition:'all 0.2s',
                  }}>
                    {m === 'generate' ? '🖼 결과' : '✏️ 편집'}
                  </button>
                ))}
              </div>
            )}

            {/* ── 생성 결과 모드 ── */}
            {mode === 'generate' && (
              <div style={{ background:'var(--white)', borderRadius:24, overflow:'hidden', position:'relative', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
                {status === 'loading' && (
                  <div style={{ padding:60, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                    <div style={{ width:40, height:40, border:'3px solid var(--gray-2)', borderTopColor:'var(--black)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:13, color:'var(--gray-4)' }}>나노바나나2 생성 중...</div>
                  </div>
                )}
                {outputUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={outputUrl} alt="Generated" style={{ width:'100%', height:'auto', display:'block', animation:'imgReveal 0.5s ease' }} />
                )}
                {!outputUrl && status !== 'loading' && (
                  <div style={{ padding:80, textAlign:'center', color:'var(--gray-3)' }}>
                    <span style={{ fontSize:44, display:'block', marginBottom:10, opacity:0.4 }}>🍌</span>
                    <p style={{ fontSize:13, lineHeight:1.7 }}>프롬프트를 입력하고<br/>생성하기를 눌러주세요</p>
                  </div>
                )}
              </div>
            )}

            {/* ── 편집 모드: 좌우 분할 ── */}
            {mode === 'edit' && outputUrl && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* 좌우 이미지 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {/* 왼쪽: 원본 + 마스크 캔버스 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, color:'var(--gray-4)', textAlign:'center', letterSpacing:1 }}>원본 · 영역 지정</div>
                    <div style={{ position:'relative', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img ref={imgRef} src={outputUrl} alt="Original" style={{ width:'100%', height:'auto', display:'block' }} />
                      <canvas
                        ref={canvasRef}
                        className="edit-canvas"
                        style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
                        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                      />
                    </div>
                  </div>
                  {/* 오른쪽: 수정 결과 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, color:'var(--gray-4)', textAlign:'center', letterSpacing:1 }}>수정 결과</div>
                    <div style={{ borderRadius:20, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', background:'var(--white)', minHeight:120, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      {status === 'loading' && (
                        <div style={{ padding:40, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, border:'2.5px solid var(--gray-2)', borderTopColor:'var(--black)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                          <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, color:'var(--gray-4)' }}>수정 중...</div>
                        </div>
                      )}
                      {editedUrl && status !== 'loading' && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={editedUrl} alt="Edited" style={{ width:'100%', height:'auto', display:'block', animation:'imgReveal 0.4s ease' }} />
                      )}
                      {!editedUrl && status !== 'loading' && (
                        <div style={{ padding:30, textAlign:'center', color:'var(--gray-3)', fontSize:12 }}>
                          <span style={{ display:'block', fontSize:28, marginBottom:6 }}>✏️</span>
                          영역 칠하고<br/>수정 지시 입력
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 편집 컨트롤 */}
                <div style={{ background:'var(--white)', borderRadius:20, padding:16, display:'flex', flexDirection:'column', gap:10, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontFamily:'Syne,sans-serif', fontSize:11, color:'var(--gray-4)', whiteSpace:'nowrap' }}>브러시</span>
                    <input type="range" min={5} max={80} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} style={{ flex:1, accentColor:'var(--black)' }} />
                    <span style={{ fontFamily:'Syne,sans-serif', fontSize:11, color:'var(--black)', minWidth:20 }}>{brushSize}</span>
                    <button onClick={clearMask} style={{ padding:'5px 12px', borderRadius:50, border:'1.5px solid var(--gray-2)', background:'var(--white)', fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:600, cursor:'pointer', color:'var(--gray-4)' }}>🗑 초기화</button>
                  </div>
                  <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                    placeholder="수정 지시를 입력하세요&#10;예: 칠한 부분을 메쉬 재질로 바꿔줘&#10;예: 여기에 간접조명 추가해줘"
                    style={{ ...inputStyle, height:70, fontSize:13 }}
                  />
                  <button className="gen-btn" onClick={applyEdit} disabled={status === 'loading'} style={{ width:'100%', padding:14, background:status==='loading'?'var(--gray-2)':'var(--black)', color:status==='loading'?'var(--gray-3)':'var(--white)', border:'none', borderRadius:20, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14, cursor:status==='loading'?'not-allowed':'pointer', transition:'all 0.2s' }}>
                    {status === 'loading' ? '⏳ 수정 중...' : '✦ 수정 적용하기'}
                  </button>
                </div>
              </div>
            )}

            {error && <div style={{ padding:'12px 16px', background:'#FFF0F0', borderRadius:16, fontSize:12, color:'#c0392b', fontFamily:'Syne,sans-serif', fontWeight:500 }}>⚠️ {error}</div>}

            {/* 메타 + 다운로드 */}
            {outputUrl && status === 'done' && (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:6, flex:1, flexWrap:'wrap' }}>
                  {['google/nano-banana-2', elapsed ? `${elapsed}s` : '', aspectRatio, resolution].filter(Boolean).map((c, i) => (
                    <div key={i} style={{ padding:'5px 10px', background:'var(--white)', borderRadius:50, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:10, color:'var(--gray-4)', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>{c}</div>
                  ))}
                </div>
                <a className="dl-btn" href={outputUrl} target="_blank" rel="noreferrer" style={{ padding:'8px 16px', background:'var(--black)', color:'var(--white)', borderRadius:50, fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:11, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5, transition:'all 0.2s' }}>⬇ 다운로드</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
