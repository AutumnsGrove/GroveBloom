-- Grove Bloom D1 Database Schema
-- Database: bloom-db

-- Server state tracking
CREATE TABLE server_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    state TEXT NOT NULL DEFAULT 'OFFLINE',
    session_id TEXT,
    vps_id TEXT,
    vps_ip TEXT,
    region TEXT,
    started_at TEXT,
    last_heartbeat TEXT,
    last_activity TEXT,
    idle_since TEXT,
    current_task TEXT,
    dns_updated_at TEXT
);

-- Session history
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    cost_usd REAL,
    region TEXT,
    server_type TEXT,
    tasks_completed INTEGER DEFAULT 0,
    shutdown_reason TEXT,  -- 'manual' | 'idle_timeout' | 'task_complete'
    tokens_used INTEGER
);

-- Task history
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    task_id TEXT UNIQUE NOT NULL,
    description TEXT,
    mode TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT,  -- 'pending' | 'running' | 'completed' | 'failed'
    tokens_used INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Configuration
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Repository manifest
CREATE TABLE repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    branch TEXT DEFAULT 'main',
    path TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_sync TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Monthly aggregates
CREATE TABLE monthly_summary (
    month TEXT PRIMARY KEY,  -- "2025-01"
    total_hours REAL,
    total_cost REAL,
    session_count INTEGER,
    tasks_completed INTEGER
);

-- Indexes for performance
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_tasks_session_id ON tasks(session_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_repositories_enabled ON repositories(enabled);
