# RAG fixtures

`rag_chunks_fixture.json.gz` is deterministic gzip-compressed JSON emitted by:

```bash
uv run python run_index.py --emit-fixture
```

Compression keeps the committed 1536-dimensional OpenAI embeddings compact while
retaining a transparent schema: model/dimension/chunker metadata plus each chunk's source
path, breadcrumb, text, token count, and embedding. The gzip header uses `mtime=0`, so
unchanged corpus/model output produces stable fixture bytes.
