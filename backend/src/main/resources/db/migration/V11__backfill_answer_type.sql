UPDATE answers
SET answer_type = CASE
  WHEN selected_option_id IS NOT NULL THEN 'CHOICE'
  WHEN speaking_audio_url IS NOT NULL AND TRIM(speaking_audio_url) <> '' THEN 'AUDIO'
  WHEN audio_url IS NOT NULL AND TRIM(audio_url) <> '' THEN 'AUDIO'
  WHEN answer_text IS NOT NULL AND TRIM(answer_text) <> '' THEN 'TEXT'
  WHEN content IS NOT NULL AND TRIM(content) <> '' THEN 'TEXT'
  ELSE answer_type
END
WHERE answer_type IS NULL;
