from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def init_db(database_url: str):
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=False)
    _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


def get_engine():
    return _engine


async def get_db():
    async with _session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def apply_schema_updates():
    if _engine is None or not _engine.url.drivername.startswith("sqlite"):
        return

    async with _engine.begin() as conn:
        async def has_column(table_name: str, column_name: str) -> bool:
            rows = (await conn.exec_driver_sql(f"PRAGMA table_info({table_name})")).fetchall()
            return any(row[1] == column_name for row in rows)

        async def add_column(table_name: str, column_name: str, definition: str):
            if not await has_column(table_name, column_name):
                await conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")

        await add_column("users", "helper_points", "INTEGER NOT NULL DEFAULT 0")
        await add_column("submissions", "total_score", "FLOAT")
        await add_column("submissions", "final_score", "FLOAT")
        await add_column("submissions", "concept_reflection_text", "TEXT")
        await add_column("submissions", "concept_reflection_score", "FLOAT")
        await add_column("submissions", "concept_reflection_passed", "BOOLEAN NOT NULL DEFAULT 0")
        await add_column("submissions", "concept_reflection_feedback", "TEXT")
        await add_column("submissions", "rubric_evaluation_json", "TEXT")
        await add_column("submissions", "evaluation_runs_count", "INTEGER NOT NULL DEFAULT 0")
        await add_column("problems", "core_concepts_json", "TEXT")
        await add_column("problems", "methodology_json", "TEXT")
        await add_column("problems", "concept_check_questions_json", "TEXT")
