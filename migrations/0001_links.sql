CREATE TABLE fields (
 key TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('text','url','number','boolean','select')),
 required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
 is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1)),
 options_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(options_json)),
 builtin INTEGER NOT NULL DEFAULT 0 CHECK(builtin IN (0,1)),
 position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE links (
 id TEXT PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 values_json TEXT NOT NULL CHECK(json_valid(values_json)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX links_published_order ON links(json_extract(values_json, '$.published'), json_extract(values_json, '$.position'));
