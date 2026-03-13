# 나노바나나2 🍌

Google Nano Banana 2 (Gemini 3.1 Flash Image) 이미지 생성기 — Replicate API + Next.js + Vercel

## 로컬 개발

### 1. 패키지 설치
```bash
npm install
```

### 2. API 토큰 설정
`.env.local` 파일에 Replicate 토큰 입력:
```
REPLICATE_API_TOKEN=r8_여기에_실제_토큰_입력
```
토큰 발급: https://replicate.com/account/api-tokens

### 3. 개발 서버 실행
```bash
npm run dev
```
http://localhost:3000 에서 확인

---

## Vercel 배포

### 1. GitHub에 푸시
```bash
git init
git add .
git commit -m "init: 나노바나나2"
git remote add origin https://github.com/YOUR_USERNAME/nanobana2.git
git push -u origin main
```

### 2. Vercel 연결
1. https://vercel.com 로그인
2. Add New Project → GitHub 레포 선택
3. Environment Variables 에서 추가:
   - Key: REPLICATE_API_TOKEN
   - Value: r8_실제토큰값
4. Deploy 클릭

### 주의사항
- .env.local은 .gitignore에 포함되어 GitHub에 올라가지 않습니다
- API 토큰은 Vercel 환경변수에서만 관리하세요
- API 호출은 /api/generate 서버 라우트를 통해서만 이루어져 브라우저에 토큰이 노출되지 않습니다
