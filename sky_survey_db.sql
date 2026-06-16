
CREATE DATABASE IF NOT EXISTS sky_survey_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sky_survey_db;
-- ----------------------------------------------------------------
-- surveys
-- ----------------------------------------------------------------
CREATE TABLE surveys (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL,
  description TEXT,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- questions
-- ----------------------------------------------------------------
CREATE TABLE questions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  survey_id   INT UNSIGNED  NOT NULL,
  name        VARCHAR(100)  NOT NULL,           -- machine-readable key
  type        ENUM(
                'short_text',
                'long_text',
                'email',
                'single_choice',
                'multiple_choice',
                'file'
              )              NOT NULL,
  text        VARCHAR(500)  NOT NULL,           -- human-readable label
  description VARCHAR(500),
  required    TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT UNSIGNED  NOT NULL DEFAULT 0,
  -- file-specific constraints (NULL for non-file questions)
  file_format          VARCHAR(50),             -- e.g. ".pdf"
  file_max_size        INT UNSIGNED,            -- numeric value
  file_max_size_unit   VARCHAR(10),             -- e.g. "mb"
  file_multiple        TINYINT(1),
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_survey
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- question_options  (for single_choice / multiple_choice)
-- ----------------------------------------------------------------
CREATE TABLE question_options (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id INT UNSIGNED  NOT NULL,
  value       VARCHAR(100)  NOT NULL,   -- stored value, e.g. "REACT"
  label       VARCHAR(255)  NOT NULL,   -- display label, e.g. "React JS"
  sort_order  INT UNSIGNED  NOT NULL DEFAULT 0,
  CONSTRAINT fk_options_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- ----------------------------------------------------------------
-- survey_responses  (one row per survey submission)
-- ----------------------------------------------------------------
CREATE TABLE survey_responses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  survey_id   INT UNSIGNED  NOT NULL,
  submitted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_responses_survey
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- response_answers  (one row per question per response)
-- ----------------------------------------------------------------
CREATE TABLE response_answers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  response_id INT UNSIGNED  NOT NULL,
  question_id INT UNSIGNED  NOT NULL,
  -- For text/email/choice answers the value is stored here.
  -- For multiple_choice, values are comma-separated (e.g. "REACT,VUE").
  -- For file questions this column is NULL (see certificates table).
  answer      TEXT,
  CONSTRAINT fk_answers_response
    FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- certificates  (uploaded PDF files linked to a response_answer)
-- ----------------------------------------------------------------
CREATE TABLE certificates (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  response_id     INT UNSIGNED  NOT NULL,
  question_id     INT UNSIGNED  NOT NULL,
  original_name   VARCHAR(255)  NOT NULL,   -- original filename
  stored_path     VARCHAR(500)  NOT NULL,   -- path on disk / object store
  mime_type       VARCHAR(100)  NOT NULL DEFAULT 'application/pdf',
  file_size       INT UNSIGNED,             -- bytes
  uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_response
    FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Indexes for common query patterns
-- ----------------------------------------------------------------
CREATE INDEX idx_questions_survey    ON questions(survey_id);
CREATE INDEX idx_options_question    ON question_options(question_id);
CREATE INDEX idx_answers_response    ON response_answers(response_id);
CREATE INDEX idx_answers_question    ON response_answers(question_id);
CREATE INDEX idx_cert_response       ON certificates(response_id);
-- Used for email filtering: join response_answers where question type = email
CREATE INDEX idx_responses_survey    ON survey_responses(survey_id);
