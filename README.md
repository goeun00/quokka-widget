# 🐾 Tiny Clerk

> Jira 이슈, GitHub PR, Logwork를 한 곳에서 확인하는 Electron 기반 개인 업무 도크 앱

매일 확인해야 하는 Jira 업무, GitHub PR, Jira 로그워크를 한 화면에 모아주는 작은 업무 비서입니다.  
업무 현황을 빠르게 보고, 이슈별 메모/브랜치/링크를 관리하고, 로그워크 기반 업무보고 엑셀도 만들 수 있어요.

---

## ✨ Features

- **Home**  
  이번 달 로그워크, 진행 중 Jira 이슈, 오픈 PR 요약

- **[Home]Logwork**  
  Jira worklog 기반 월별 작업 시간을 확인해용.  
  월별 합산은 worklog의 `Date Started` 기준으로 계산하며, 선택한 월 범위 안에 시작된 worklog만 포함합니다.

- **[Home]Excel Export**  
  Jira 로그워크의 기준으로 업무보고용 엑셀을 생성합니다.  
  `소요시간(D)`은 해당 월에 내가 등록한 worklog를 이슈별로 합산하고, `8h = 1d` 기준으로 계산합니다.

  | 업무 시작일 | `Target start` |
  | 업무 종료일 | `Target end` |
  | Mark up Delivery | `Expected Delivery Date` |
  | 소요시간(D) | 내가 등록한 worklog 합계 |
  | 비고 | Jira issue URL |

- **Jira**  
  TODO / WIP / DONE / PIN 필터, 검색, 메모, 브랜치, 링크 관리
  DONE 된 이슈는 설정에서 설정한 날짜 기준에따라 기간이 지나면 삭제됩니다.

- **[Jira]Pinned Issues**  
  내가 원하는 이슈만 PIN으로 고정해두기
  PIN 된 이슈는 DONE 설정기간이 지나도 사라지지 않아용!

- **Pull Requests**  
  내가 작성한 GitHub PR 목록 확인, Open / Merged / Closed 필터

---

## 🗂 Project Structure

widget
├─ main.js # Electron main process, IPC, Excel export
├─ renderer.js # UI state, events, rendering
├─ jira.js # Jira API
├─ github.js # GitHub API
├─ store.js # Local storage
├─ preload.js # API bridge
├─ index.html # Markup
├─ style.css # Styles
└─ package.json
