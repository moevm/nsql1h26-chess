const BASE_ELO = 1200;

function kFactor(rating) {
  if (rating >= 2400) return 10;
  if (rating >= 2100) return 16;
  return 32;
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateRatings(whiteElo, blackElo, whiteScore) {
  const expectedWhite = expectedScore(whiteElo, blackElo);
  const blackScore = 1 - whiteScore;
  const kw = kFactor(whiteElo);
  const kb = kFactor(blackElo);
  return {
    whiteNew: Math.round(whiteElo + kw * (whiteScore - expectedWhite)),
    blackNew: Math.round(blackElo + kb * (blackScore - (1 - expectedWhite)))
  };
}

function eloTitle(elo) {
  if (elo >= 2500) return 'Гроссмейстер';
  if (elo >= 2400) return 'Международный мастер';
  if (elo >= 2200) return 'Мастер ФИДЕ';
  if (elo >= 2000) return 'Кандидат в мастера';
  if (elo >= 1800) return 'Эксперт';
  if (elo >= 1600) return 'Опытный игрок';
  if (elo >= 1400) return 'Уверенный любитель';
  if (elo >= 1200) return 'Любитель';
  return 'Новичок';
}

module.exports = {
  BASE_ELO,
  kFactor,
  expectedScore,
  updateRatings,
  eloTitle
};
