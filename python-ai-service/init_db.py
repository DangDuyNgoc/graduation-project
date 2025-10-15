import sqlite3
import os

DB_PATH = "database.db"


def init_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("Old database was deleted and created...")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # --- Table: materials ---
    cursor.execute(
        """
        CREATE TABLE materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            courseId TEXT,
            submissionId TEXT,
            ownerType TEXT,
            title TEXT,
            s3_url TEXT,
            s3_key TEXT,
            fileType TEXT,
            uploadedAt TEXT DEFAULT (datetime('now')),
            processingStatus TEXT DEFAULT 'pending' 
                CHECK(processingStatus IN ('pending','processing','done','error')),
            chunkCount INTEGER DEFAULT 0,
            extractedTextLength INTEGER DEFAULT 0
        )
    """
    )

    # --- Table: chunks ---
    cursor.execute(
        """
        CREATE TABLE chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            materialId INTEGER NOT NULL,
            faissId INTEGER,
            text TEXT,
            embedding TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (materialId) REFERENCES materials(id) ON DELETE CASCADE
        )
    """
    )

    # Indexing
    cursor.execute("CREATE INDEX idx_chunks_materialId ON chunks(materialId)")

    conn.commit()
    conn.close()
    print("Database and tables were created fresh with indexes!")


if __name__ == "__main__":
    init_db()
