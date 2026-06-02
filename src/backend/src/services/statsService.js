const { playersCol } = require('../models/playerModel');
const { ccGamesCol } = require('../models/circularChessModel');
const ApiError = require('../utils/ApiError');

const TERMINAL_STATUSES = ['checkmate', 'stalemate', 'resigned', 'draw', 'abandoned'];

async function overview() {
  const [playersCount, botsCount, gamesCount, completedCount] = await Promise.all([
    playersCol().countDocuments({ type: 'player' }),
    playersCol().countDocuments({ type: 'bot' }),
    ccGamesCol().countDocuments(),
    ccGamesCol().countDocuments({ status: { $in: TERMINAL_STATUSES } })
  ]);
  return {
    players: playersCount,
    bots: botsCount,
    games: gamesCount,
    completed_games: completedCount
  };
}

const STATUS_PLAYER = [
  { value: 'active', label: 'Активен' },
  { value: 'banned', label: 'Заблокирован' },
  { value: 'deleted', label: 'Удалён' }
];
const STATUS_BOT = [
  { value: 'draft', label: 'Черновик' },
  { value: 'testing', label: 'Тестирование' },
  { value: 'active', label: 'Активен' },
  { value: 'disabled', label: 'Отключён' }
];
const STATUS_GAME = [
  { value: 'active', label: 'Идёт' },
  { value: 'check', label: 'Шах' },
  { value: 'checkmate', label: 'Мат' },
  { value: 'stalemate', label: 'Пат' },
  { value: 'resigned', label: 'Сдача' },
  { value: 'draw', label: 'Ничья' },
  { value: 'abandoned', label: 'Прервана' }
];

// Числовые поля статистики, общие для игроков и ботов.
const STAT_FIELDS = [
  { key: 'elo', label: 'ELO', type: 'num', axis: true, filter: true, path: '$stats.elo', bucket: 100 },
  { key: 'wins', label: 'Победы', type: 'num', axis: true, filter: true, path: '$stats.wins', bucket: 5 },
  { key: 'losses', label: 'Поражения', type: 'num', axis: true, filter: true, path: '$stats.losses', bucket: 5 },
  { key: 'draws', label: 'Ничьи', type: 'num', axis: true, filter: true, path: '$stats.draws', bucket: 5 },
  { key: 'total_games', label: 'Всего партий', type: 'num', axis: true, filter: true, path: '$stats.total_games', bucket: 5 }
];

const DATASETS = {
  players: {
    label: 'Игроки',
    col: playersCol,
    baseFilter: { type: 'player' },
    fields: [
      { key: 'status', label: 'Статус', type: 'cat', axis: true, filter: true, path: '$status', options: STATUS_PLAYER },
      { key: 'role', label: 'Роль', type: 'cat', axis: true, filter: true, path: '$role',
        options: [{ value: 'admin', label: 'Администратор' }, { value: 'user', label: 'Пользователь' }] },
      ...STAT_FIELDS,
      { key: 'username', label: 'Логин содержит', type: 'text', axis: false, filter: true, path: '$username' },
      { key: 'created_at', label: 'Дата регистрации', type: 'date', axis: false, filter: true, path: '$created_at' }
    ]
  },
  bots: {
    label: 'Боты',
    col: playersCol,
    baseFilter: { type: 'bot' },
    fields: [
      { key: 'status', label: 'Статус', type: 'cat', axis: true, filter: true, path: '$status', options: STATUS_BOT },
      ...STAT_FIELDS,
      { key: 'name', label: 'Название содержит', type: 'text', axis: false, filter: true, path: '$name' },
      { key: 'created_at', label: 'Дата создания', type: 'date', axis: false, filter: true, path: '$created_at' }
    ]
  },
  games: {
    label: 'Партии',
    col: ccGamesCol,
    baseFilter: {},
    fields: [
      { key: 'status', label: 'Статус', type: 'cat', axis: true, filter: true, path: '$status', options: STATUS_GAME },
      { key: 'turn', label: 'Чей ход', type: 'cat', axis: true, filter: true, path: '$turn',
        options: [{ value: 'w', label: 'Белые' }, { value: 'b', label: 'Чёрные' }] },
      { key: 'move_number', label: 'Номер хода', type: 'num', axis: true, filter: true, path: '$move_number', bucket: 5 },
      { key: 'moves_count', label: 'Длина партии (ходов)', type: 'num', axis: true, filter: false, bucket: 5,
        expr: { $size: { $ifNull: ['$moves', []] } } },
      { key: 'created_at', label: 'Дата создания', type: 'date', axis: false, filter: true, path: '$created_at' }
    ]
  }
};

function getDataset(key) {
  const ds = DATASETS[key || 'players'];
  if (!ds) throw new ApiError(400, `Недопустимое подмножество данных: ${key}`);
  return ds;
}

function schema() {
  return {
    datasets: Object.entries(DATASETS).map(([key, ds]) => ({
      key,
      label: ds.label,
      axes: ds.fields.filter(f => f.axis).map(f => ({
        key: f.key, label: f.label, type: f.type, default_bucket: f.bucket || null
      })),
      filters: ds.fields.filter(f => f.filter).map(f => ({
        key: f.key, label: f.label, type: f.type, options: f.options || null
      }))
    }))
  };
}

function buildFilter(ds, q) {
  const filter = { ...ds.baseFilter };
  for (const f of ds.fields) {
    if (!f.filter) continue;
    const key = f.path.replace(/^\$/, '');
    if (f.type === 'cat') {
      const v = q[`flt_${f.key}`];
      if (v) filter[key] = v;
    } else if (f.type === 'text') {
      const v = q[`flt_${f.key}`];
      if (v) filter[key] = { $regex: v, $options: 'i' };
    } else if (f.type === 'num') {
      const min = q[`flt_${f.key}_min`];
      const max = q[`flt_${f.key}_max`];
      if (min || max) {
        filter[key] = {};
        if (min) filter[key].$gte = parseInt(min);
        if (max) filter[key].$lte = parseInt(max);
      }
    } else if (f.type === 'date') {
      const from = q[`flt_${f.key}_from`];
      const to = q[`flt_${f.key}_to`];
      if (from || to) {
        filter[key] = {};
        if (from) filter[key].$gte = new Date(from);
        if (to) filter[key].$lte = new Date(to + 'T23:59:59Z');
      }
    }
  }
  return filter;
}

function findAxisField(ds, key, axisName) {
  const f = ds.fields.find(field => field.key === key && field.axis);
  if (!f) throw new ApiError(400, `Недопустимый атрибут оси ${axisName}: ${key}`);
  return f;
}

function resolveBucket(field, raw) {
  if (field.type !== 'num') return null;
  const n = parseInt(raw);
  return n && n > 0 ? n : field.bucket;
}

function rawValueExpr(field) {
  if (field.expr) return field.expr;
  return { $ifNull: [field.path, field.type === 'num' ? 0 : '—'] };
}

function axisExpr(field, bucket) {
  const v = rawValueExpr(field);
  if (field.type === 'num') {
    return { $multiply: [{ $floor: { $divide: [v, bucket] } }, bucket] };
  }
  return v;
}

function numLabel(start, size) {
  return size === 1 ? String(start) : `${start}–${start + size - 1}`;
}

function valueLabel(field, raw, bucket) {
  if (field.type === 'num') return numLabel(Number(raw), bucket);
  if (raw === '—') return '—';
  if (field.options) {
    const o = field.options.find(opt => opt.value === raw);
    if (o) return o.label;
  }
  return String(raw);
}

async function distribution(query) {
  const ds = getDataset(query.dataset);
  const xField = findAxisField(ds, query.x, 'X');
  const yField = findAxisField(ds, query.y, 'Y');

  const xBucket = resolveBucket(xField, query.x_bucket);
  const yBucket = resolveBucket(yField, query.y_bucket);
  const filter = buildFilter(ds, query);

  const rows = await ds.col().aggregate([
    { $match: filter },
    {
      $group: {
        _id: { x: axisExpr(xField, xBucket), y: axisExpr(yField, yBucket) },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const xSet = new Map();
  const ySet = new Map();
  const cells = {};
  let total = 0;

  const register = (set, field, bucket, raw) => {
    const key = String(raw);
    if (!set.has(key)) {
      set.set(key, {
        sort: field.type === 'num' ? Number(raw) : key,
        label: valueLabel(field, raw, bucket)
      });
    }
    return key;
  };

  for (const r of rows) {
    const xk = register(xSet, xField, xBucket, r._id.x);
    const yk = register(ySet, yField, yBucket, r._id.y);
    cells[`${xk}||${yk}`] = r.count;
    total += r.count;
  }

  const sortEntries = (set, field) => {
    const arr = [...set.entries()];
    arr.sort((a, b) =>
      field.type === 'num'
        ? a[1].sort - b[1].sort
        : String(a[1].sort).localeCompare(String(b[1].sort))
    );
    return arr.map(([key, v]) => ({ key, label: v.label }));
  };

  return {
    dataset: { key: query.dataset || 'players', label: ds.label },
    x: { field: xField.key, label: xField.label, type: xField.type, bucket: xBucket, values: sortEntries(xSet, xField) },
    y: { field: yField.key, label: yField.label, type: yField.type, bucket: yBucket, values: sortEntries(ySet, yField) },
    cells,
    total
  };
}

module.exports = { overview, schema, distribution };
