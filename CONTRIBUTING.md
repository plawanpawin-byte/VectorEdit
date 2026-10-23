# Contributing

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # type-check + tests
```

- Tools live in `src/tools/` and register through `registry.ts`; a tool is a `ToolDef` whose `down()` returns a pointer session.
- Document changes go through the store (`commit`, `commitDoc`, `live`/`endLive`) so undo works.
- Add a Vitest test for any geometry, file-format or store change.
- Write original code and assets. Do not copy code, icons or text from other editors.
