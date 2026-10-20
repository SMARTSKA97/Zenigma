-- The furthest practice level any player has solved, per track. Run by the "Level reach" workflow; output is `track,level` lines.
-- (Word Guess is left out: its practice has no levels.)
SELECT track || ',' || max(lvl)
FROM (
    SELECT
        CASE WHEN position(':' IN level_key) > 0 THEN game || '-' || split_part(level_key, ':', 1) ELSE game END AS track,
        CASE WHEN position(':' IN level_key) > 0 THEN split_part(level_key, ':', 2)::int ELSE level_key::int END AS lvl
    FROM practice_solves
    WHERE game <> 'word-guess' AND (level_key ~ '^[0-9]+$' OR level_key ~ '^[a-z0-9-]+:[0-9]+$')
) s
GROUP BY track
ORDER BY track;
