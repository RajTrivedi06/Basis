# RAG fixtures

`rag_chunks_fixture.json.gz` is deterministic gzip-compressed JSON emitted by:

```bash
uv run python run_index.py --emit-fixture
```

Compression keeps the committed 1536-dimensional OpenAI embeddings compact while
retaining a transparent schema: model/dimension/chunker metadata plus each chunk's source
path, breadcrumb, text, token count, and embedding. The gzip header uses `mtime=0`, so
unchanged corpus/model output produces stable fixture bytes.

The alternative chunker fixture is emitted with:

```bash
uv run python run_index.py --chunker fixed --emit-fixture
```

Both commands also refresh `rag_eval_query_embeddings.json.gz`, an exact-text mapping for
the Manager/Raj golden questions. It is enabled only by `ASK_EVAL_MODE=1`, allowing CI to
exercise both retrieval legs without an `OPENAI_API_KEY` or any embedding API call.
