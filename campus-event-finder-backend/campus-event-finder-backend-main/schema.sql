-- Campus Event Finder Full Schema (Flexible Admin Version)

-- Reset tables
DROP TABLE IF EXISTS user_likes;
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS event_comments;
DROP TABLE IF EXISTS event_metrics;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS events;

-- 1. Events Table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date VARCHAR(64) NOT NULL,
  time VARCHAR(64) NOT NULL,
  image TEXT NULL,               -- Optional
  category VARCHAR(64) NOT NULL,
  description TEXT NULL,         -- Made Optional (Removed NOT NULL)
  summary TEXT NULL,             -- Made Optional (Removed NOT NULL)
  location VARCHAR(255) NOT NULL,
  organizer VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  capacity INT NULL,             -- Optional
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(120) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Event Metrics Table
CREATE TABLE IF NOT EXISTS event_metrics (
  event_id VARCHAR(32) PRIMARY KEY,
  likes INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_event_metrics_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Event Comments Table
CREATE TABLE IF NOT EXISTS event_comments (
  id VARCHAR(50) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL,
  parent_comment_id VARCHAR(50) NULL,
  author VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_event_comments_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_comments_parent
    FOREIGN KEY (parent_comment_id) REFERENCES event_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Event Registrations Table
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

-- 5. User Likes Table
CREATE TABLE IF NOT EXISTS user_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(150) NOT NULL,
  event_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_event (user_email, event_id),
  CONSTRAINT fk_user_likes_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Comment Likes Table
CREATE TABLE IF NOT EXISTS comment_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(150) NOT NULL,
  comment_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_comment (user_email, comment_id),
  CONSTRAINT fk_comment_likes_comment
    FOREIGN KEY (comment_id) REFERENCES event_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Admin Codes Table
CREATE TABLE IF NOT EXISTS admin_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  created_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Reset Tokens Table
CREATE TABLE IF NOT EXISTS reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  token VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;