"""add pgvector extension and doc_chunks table

The embedding dimension is intentionally fixed at 1536 for hosted OpenAI
text-embedding-3-small vectors. The downgrade drops the table and its indexes
but deliberately leaves the vector extension installed: the extension is
cheap, and other database objects may come to depend on it.

Revision ID: c8d9e2f1a4b6
Revises: b7f3a9c2d1e4
Create Date: 2026-07-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c8d9e2f1a4b6"
down_revision: str | None = "b7f3a9c2d1e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "doc_chunks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("heading", sa.String(), nullable=True),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(dim=1536), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column(
            "chunk_tsv",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('english', chunk_text)", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_doc_chunks_source_path",
        "doc_chunks",
        ["source_path"],
        unique=False,
    )
    op.create_index(
        "ix_doc_chunks_embedding_hnsw",
        "doc_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_index(
        "ix_doc_chunks_chunk_tsv",
        "doc_chunks",
        ["chunk_tsv"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_doc_chunks_chunk_tsv",
        table_name="doc_chunks",
        postgresql_using="gin",
    )
    op.drop_index(
        "ix_doc_chunks_embedding_hnsw",
        table_name="doc_chunks",
        postgresql_using="hnsw",
    )
    op.drop_index("ix_doc_chunks_source_path", table_name="doc_chunks")
    op.drop_table("doc_chunks")
