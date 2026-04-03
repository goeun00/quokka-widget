# 🦘 쿼카 큐비 바탕화면 위젯

귀여운 쿼카 큐비가 바탕화면 우하단에 떠있는 위젯이에요!

## 📦 설치 방법

### 1. Node.js 설치
https://nodejs.org 에서 LTS 버전 설치

### 2. 폴더 구조 만들기
```
quokka-widget/
├── main.js
├── preload.js
├── index.html
├── package.json
└── assets/
    └── quokka.mp4   ← ★ 여기에 MP4 파일 넣기!
```

### 3. MP4 파일 넣기
- Pika에서 받은 MP4 파일을 `assets` 폴더에 넣기
- 파일명을 `quokka.mp4` 로 변경
- (다른 이름 쓰려면 index.html에서 src 경로 수정)

### 4. 실행하기
```bash
# 이 폴더에서 터미널 열고
npm install
npm start
```

## 🎮 사용법

- **클릭** → 말풍선 메시지 + 점프!
- **드래그** → 상단 빈 영역 잡고 이동
- **우클릭** → 메뉴 (상태변경 / 종료)

## ✨ 기능

- 바탕화면 우하단 고정
- 항상 위에 떠있음
- 투명 배경
- 클릭하면 귀여운 반응
- 상태 메시지 자동 변경

## 🔧 커스터마이징

`index.html` 에서:
- `messages` 배열 → 클릭시 나오는 메시지 변경
- `statuses` 배열 → 하단 상태 메시지 변경
- `width/height` → 위젯 크기 변경 (main.js에서도 동일하게)
