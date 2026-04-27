quokka_search_svg_patch

교체 파일:
- index.html
- renderer.js
- style.css
- main.js
- jira.js
- github.js
- assets/icons/*.svg

변경 내용:
1) Jira 검색 강화
   - 일반 검색: 배송 팝오버
   - 필드 검색: key:WPR-3014, status:wip, status:done, branch:feature, memo:QA, link:figma, pin:true

2) PR 검색 강화
   - 일반 검색: starro 배송
   - 필드 검색: repo:starro, owner:goeun00, title:배송, branch:feature, head:feature, base:main, state:open, status:done, number:3014

3) SVG 아이콘 분리
   - renderer.js의 동적 아이콘은 assets/icons/*.svg 파일로 분리
   - style.css에서 CSS mask 방식으로 사용

4) Jira 회사/개인 분기
   - 회사 Jira: Bearer token + /rest/api/2/search
   - 개인 Jira Cloud(*.atlassian.net): Basic email:token + /rest/api/3/search/jql
   - 설정창에서 개인 Jira 체크 시 email 입력 노출

주의:
- main.js에서 fetch-issues / fetch-issues-by-keys 핸들러는 각각 1개만 남겨야 합니다.
- 기존 파일 백업 후 교체하세요.
