-- Auto-create tables (safe for startup)

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date VARCHAR(64) NOT NULL,
  time VARCHAR(64) NOT NULL,
  image TEXT,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  summary TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  organizer VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  capacity INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_metrics (
  event_id VARCHAR(32) PRIMARY KEY,
  likes INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_event_metrics_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_comments (
  id VARCHAR(50) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL,
  author VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_event_comments_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_registrations (
  id VARCHAR(50) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  department VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL,
  registered_at DATETIME NOT NULL,
  attended TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_event_user (event_id, user_id),
  CONSTRAINT fk_event_registrations_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
