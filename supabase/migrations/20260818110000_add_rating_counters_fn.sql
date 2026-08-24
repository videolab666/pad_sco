-- Инкремент счётчиков рейтинга (§31): upsert не суммирует, нужна RPC.
-- Вызывается из lib/rating-service.ts applyMatchRatings.

CREATE OR REPLACE FUNCTION increment_rating_counters(
  p_club_id UUID,
  p_player_id UUID,
  p_rating_type TEXT,
  p_won BOOLEAN,
  p_lost BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE player_ratings
  SET
    matches_played = matches_played + 1,
    wins = wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_lost THEN 1 ELSE 0 END,
    last_match_at = NOW(),
    updated_at = NOW()
  WHERE club_id = p_club_id
    AND player_id = p_player_id
    AND rating_type = p_rating_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
