-- Capture the respondent's employer (optional) on the survey complete screen.
-- Stored alongside email so editors can segment responses by company.

alter table survey_responses
  add column if not exists employer text;
