# Notion Local MCP Server

Notion 데스크탑 앱의 로컬 SQLite 캐시에서 문서를 검색하고 조회하는 MCP 서버입니다.

## 기능

- **키워드 검색** - 제목/내용에서 키워드로 페이지 검색
- **최근 문서 목록** - 최근 수정/접근한 문서 목록 조회
- **페이지 내용 조회** - 특정 페이지의 전체 내용(블록들) 읽기
- **계층 탐색** - 상위/하위 페이지 구조 탐색

## 설치

```bash
npm install
npm run build
```

## Claude Code 설정

`~/.claude.json`의 `mcpServers`에 추가:

```json
{
  "mcpServers": {
    "notion-local": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/notion-local/dist/index.js"],
      "env": {
        "NOTION_DB_PATH": "/Users/YOUR_USERNAME/Library/Application Support/Notion/notion.db"
      }
    }
  }
}
```

## MCP 도구

### notion_local_search
키워드로 페이지 검색

```typescript
{
  query: string,      // 검색어 (필수)
  type?: "page" | "all",  // 검색 범위 (기본: page)
  limit?: number      // 최대 결과 수 (기본: 20)
}
```

### notion_local_recent
최근 수정된 페이지 목록

```typescript
{
  limit?: number,     // 최대 결과 수 (기본: 20)
  days?: number       // 며칠 이내 (기본: 30)
}
```

### notion_local_get_page
페이지 전체 내용 조회

```typescript
{
  pageId: string,     // 페이지 UUID (필수)
  depth?: number      // 중첩 블록 깊이 (기본: 3)
}
```

### notion_local_parent
페이지의 상위 계층 조회

```typescript
{
  pageId: string      // 페이지 UUID (필수)
}
```

### notion_local_children
페이지의 하위 페이지 목록

```typescript
{
  pageId: string,     // 페이지 UUID (필수)
  depth?: number      // 탐색 깊이 (기본: 2)
}
```

## 주의사항

- **읽기 전용**: 로컬 캐시만 읽으며, Notion 데이터를 수정하지 않습니다.
- **Notion 앱 필요**: Notion 데스크탑 앱이 설치되어 있어야 캐시가 존재합니다.
- **macOS 전용**: 현재 macOS의 캐시 경로만 지원합니다.
- **동기화 지연**: 최근 변경사항은 Notion 앱이 동기화될 때까지 반영되지 않을 수 있습니다.

## 라이선스

MIT
