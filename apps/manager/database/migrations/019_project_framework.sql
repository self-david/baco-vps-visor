ALTER TABLE projects
  ADD COLUMN framework TEXT NOT NULL DEFAULT 'Desconocido'
    CHECK (char_length(framework) BETWEEN 1 AND 80);
