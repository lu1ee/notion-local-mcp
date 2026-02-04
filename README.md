# Notion Local MCP

Notion 데스크탑 앱의 로컬 SQLite 캐시를 읽어 Claude에서 빠르게 Notion 문서를 검색하고 조회하는 MCP 서버입니다.

## 빠른 시작 (Quick Start)

### 1. 필수 조건

- [Node.js 18+](https://nodejs.org/) 설치
- [Notion 데스크탑 앱](https://www.notion.so/desktop) 설치 및 로그인

### 2. 자동 설정

터미널에서 아래 명령어를 실행하면 자동으로 설정됩니다:

```bash
npx @lu1ee/notion-local-mcp setup
```

```
🔧 Notion Local MCP Setup
========================================

🔍 Operating system: macOS
✅ Notion found: /Users/user/Library/Application Support/Notion/notion.db

Which apps do you want to configure?

  1. Claude Desktop Chat
  2. Claude Code (CLI)
  3. Both (recommended)

Enter choice [1-3, default: 3]: 3

========================================

✅ Claude Desktop: Successfully configured notion-local for Claude Desktop
✅ Claude Code: Successfully configured notion-local for Claude Code

🎉 Setup complete!

Please restart your Claude app to apply the changes.
```

### 3. 앱 재시작

Claude Desktop 또는 Claude Code를 재시작하면 사용할 수 있습니다.

**끝!**

---

## Notion API MCP vs notion-local

| | Notion API MCP | notion-local |
|---|---|---|
| **동작 방식** | Notion 서버 API 호출 | 로컬 SQLite 직접 읽기 |
| **Notion AI** | 사용 (시맨틱 검색) | **사용 안 함** |
| **속도** | 느림 (네트워크) | 빠름 (로컬) |
| **오프라인** | 불가능 | 가능 |
| **Rate Limit** | 있음 | 없음 |
| **데이터 최신성** | 실시간 | Notion 앱 동기화 시점 |
| **쓰기 기능** | 있음 | 없음 (읽기 전용) |

**권장 사용법:**
- **검색/조회** → `notion-local` (빠름, Notion AI 미사용, 오프라인 가능)
- **생성/수정** → `Notion API MCP` (쓰기는 서버 API 필요)

---

## 지원 플랫폼

| OS | Notion DB 경로 | 상태 |
|---|---|---|
| macOS | `~/Library/Application Support/Notion/notion.db` | ✅ 검증됨 |
| Windows | `%APPDATA%\Notion\notion.db` | ✅ 지원 (미검증) |
| Linux | `~/.config/Notion/notion.db` | ⚠️ 비공식 |

> **참고**: Notion은 [공식 Linux 데스크탑 앱을 제공하지 않습니다](https://wiki.archlinux.org/title/Notion-app). Linux에서는 커뮤니티 비공식 빌드(예: notion-app-electron)에서만 동작할 수 있습니다.

---

## MCP 도구

### notion_local_search

키워드로 페이지 검색

```typescript
{
  query: string,          // 검색어 (필수)
  type?: "page" | "all",  // 검색 범위 (기본: page)
  limit?: number          // 최대 결과 수 (기본: 20)
}
```

### notion_local_recent

최근 수정된 페이지 목록

```typescript
{
  limit?: number,   // 최대 결과 수 (기본: 20)
  days?: number     // 며칠 이내 (기본: 30)
}
```

### notion_local_get_page

페이지 전체 내용 조회

```typescript
{
  pageId: string,   // 페이지 UUID (필수)
  depth?: number    // 중첩 블록 깊이 (기본: 3)
}
```

### notion_local_parent

페이지의 상위 계층 조회

```typescript
{
  pageId: string    // 페이지 UUID (필수)
}
```

### notion_local_children

페이지의 하위 페이지 목록

```typescript
{
  pageId: string,   // 페이지 UUID (필수)
  depth?: number    // 탐색 깊이 (기본: 2)
}
```

---

## 수동 설정 (고급)

자동 설정이 안 될 경우 수동으로 설정할 수 있습니다.

### Claude Desktop Chat

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "notion-local": {
      "command": "npx",
      "args": ["-y", "@lu1ee/notion-local-mcp"],
      "env": {
        "NOTION_DB_PATH": "/Users/YOUR_USERNAME/Library/Application Support/Notion/notion.db"
      }
    }
  }
}
```

### Claude Code

`~/.claude.json`:

```json
{
  "mcpServers": {
    "notion-local": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@lu1ee/notion-local-mcp"],
      "env": {
        "NOTION_DB_PATH": "/Users/YOUR_USERNAME/Library/Application Support/Notion/notion.db"
      }
    }
  }
}
```

---

## 개발

로컬에서 개발하려면:

```bash
git clone https://github.com/lu1ee/notion-local-mcp.git
cd notion-local-mcp
npm install
npm run build
npm run setup  # 로컬 빌드를 Claude에 연결
```

---

## 주의사항

- **읽기 전용**: 로컬 캐시만 읽으며, Notion 데이터를 수정하지 않습니다.
- **Notion 앱 필요**: Notion 데스크탑 앱이 설치되어 있어야 캐시가 존재합니다.
- **동기화 지연**: 최근 변경사항은 Notion 앱이 동기화될 때까지 반영되지 않을 수 있습니다.

---

## 라이선스

MIT
