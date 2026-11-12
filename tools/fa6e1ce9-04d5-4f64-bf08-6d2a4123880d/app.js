'use strict';
/**
 * 晴空物语 · 校园工坊网页版
 * ---------------------------------------------------------------------------
 * 纯前端单页工具，无网络依赖。全部数据保存在 localStorage 的单个 key：
 *   qingkong.v1
 *
 * 数据结构（version 1）：
 *   {
 *     version: 1,
 *     settings: { termStart, weeks, periods: [{ start, end }] },
 *     courses:    [],
 *     goals:      [],
 *     workouts:   [],   // 同时存放「训练计划」与「训练记录」，用 kind 区分
 *     activities: [],
 *     books:      []
 *   }
 *
 * 设计约定：
 * - 不使用 inline style / inline script / style 属性（服务端 CSP 只允许同源
 *   style-src / script-src）。动态进度条宽度通过 CSSOM 的
 *   el.style.setProperty('--p', ...) 设置。
 * - 所有图标为内联 SVG；没有外链字体、图片或 CDN。
 * - 原生 <dialog> 弹窗，Esc / 关闭按钮可关；事件全部委托绑定，便于整块重绘。
 */
(() => {
  /* ======================================================================
     一、常量与图标
     ====================================================================== */

  const STORAGE_KEY = 'qingkong.v1';
  const VERSION = 1;

  const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const PATTERNS = { all: '每周', odd: '单周', even: '双周' };
  const ACTIVITY_STATUS = ['报名', '准备', '参加', '已结束'];
  const ACTIVITY_CATEGORIES = ['讲座', '比赛', '社团', '志愿服务', '学生工作', '其他'];
  const READING_STATUS = ['想读', '在读', '已读完'];

  const TABS = [
    { id: 'overview', label: '概览' },
    { id: 'courses', label: '课程表' },
    { id: 'goals', label: '目标' },
    { id: 'workouts', label: '训练' },
    { id: 'activities', label: '活动' },
    { id: 'reading', label: '阅读' }
  ];

  const ROUTE_ALIASES = {
    overview: 'overview',
    home: 'overview',
    courses: 'courses',
    course: 'courses',
    schedule: 'courses',
    goals: 'goals',
    goal: 'goals',
    workouts: 'workouts',
    workout: 'workouts',
    training: 'workouts',
    fitness: 'workouts',
    activities: 'activities',
    activity: 'activities',
    reading: 'reading',
    books: 'reading',
    book: 'reading'
  };

  // 默认 12 节模板：上午 4 节、下午 4 节、晚上 4 节
  const DEFAULT_PERIODS = [
    { start: '08:00', end: '08:45' },
    { start: '08:55', end: '09:40' },
    { start: '10:00', end: '10:45' },
    { start: '10:55', end: '11:40' },
    { start: '14:00', end: '14:45' },
    { start: '14:55', end: '15:40' },
    { start: '16:00', end: '16:45' },
    { start: '16:55', end: '17:40' },
    { start: '19:00', end: '19:45' },
    { start: '19:55', end: '20:40' },
    { start: '20:50', end: '21:35' },
    { start: '21:45', end: '22:30' }
  ];

  const ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
    chevronRight: '<path d="M9 18l6-6-6-6"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/>',
    upload: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
    flag: '<path d="M5 21V4M5 4h10l-2 4 2 4H5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2z"/><path d="M4 19h14"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 9v4M12 16h.01"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2"/>',
    play: '<path d="M7 4l12 8-12 8z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
  };

  /* ======================================================================
     二、DOM 引用与运行时状态
     ====================================================================== */

  const mainEl = document.getElementById('main');
  const tabsEl = document.getElementById('tabs');
  const warningEl = document.getElementById('data-warning');
  const dialogEl = document.getElementById('dialog');
  const dialogTitleEl = document.getElementById('dialog-title');
  const dialogBodyEl = document.getElementById('dialog-body');
  const toastEl = document.getElementById('toast');
  const importInput = document.getElementById('import-file');

  let state = null;           // 当前数据
  let corrupt = false;        // 本机数据是否损坏、无法读取
  let corruptMessage = '';
  let activeTab = 'overview';
  let viewWeek = null;        // 课程表周视图当前查看的教学周
  let dialogSubmit = null;    // 当前弹窗的提交处理函数
  let toastTimer = null;

  /* ======================================================================
     三、基础工具
     ====================================================================== */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') + '</svg>';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function asStr(value) { return typeof value === 'string' ? value : ''; }

  function numStr(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return asStr(value).trim();
  }

  function listOf(value) { return Array.isArray(value) ? value : []; }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }

  function findById(list, id) {
    return list.find(item => item.id === id) || null;
  }

  function formatVolume(value) {
    return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  }

  function toast(message, kind) {
    toastEl.textContent = message;
    toastEl.className = 'toast show' + (kind === 'error' ? ' error' : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.hidden = true;
    }, 3000);
  }

  /* ---------------- 日期：全部按 UTC 日序号计算，避开夏令时 ---------------- */

  function parseDay(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const y = Number(match[1]);
    const mo = Number(match[2]);
    const d = Number(match[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return { y, mo, d };
  }

  function dayIndex(value) {
    const parts = typeof value === 'string' ? parseDay(value) : value;
    if (!parts) return null;
    return Math.floor(Date.UTC(parts.y, parts.mo - 1, parts.d) / 86400000);
  }

  function dateStrFromIndex(index) {
    const date = new Date(index * 86400000);
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  function todayStr() {
    const now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  }

  function todayIndex() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  }

  // 以周一为 1、周日为 7
  function weekdayOf(value) {
    const index = dayIndex(value);
    if (index == null) return 1;
    return ((index + 3) % 7 + 7) % 7 + 1;
  }

  function addDays(value, days) {
    const index = dayIndex(value);
    if (index == null) return value;
    return dateStrFromIndex(index + days);
  }

  function mondayOfToday() {
    return dateStrFromIndex(todayIndex() - (weekdayOf(todayStr()) - 1));
  }

  function fmtDateShort(value) {
    const parts = parseDay(value);
    return parts ? pad2(parts.mo) + '/' + pad2(parts.d) : '--/--';
  }

  function fmtDateCN(value) {
    const parts = parseDay(value);
    if (!parts) return '日期待定';
    return parts.mo + '月' + parts.d + '日 ' + WEEKDAYS[weekdayOf(value) - 1];
  }

  function isValidTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function timeMinutes(value) {
    const parts = String(value || '').split(':').map(Number);
    return parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
      ? parts[0] * 60 + parts[1]
      : -1;
  }

  /* ======================================================================
     四、数据：默认值、读取、容错、保存
     ====================================================================== */

  function defaultState() {
    return {
      version: VERSION,
      settings: {
        termStart: mondayOfToday(),
        weeks: 20,
        periods: DEFAULT_PERIODS.map(period => ({ start: period.start, end: period.end }))
      },
      courses: [],
      goals: [],
      workouts: [],
      activities: [],
      books: []
    };
  }

  function dedupeIds(list) {
    const seen = new Set();
    for (const item of list) {
      let id = asStr(item.id);
      if (!id || seen.has(id)) id = uid();
      item.id = id;
      seen.add(id);
    }
    return list;
  }

  function sanitizeCourse(course, maxPeriod) {
    if (!course || typeof course !== 'object') return null;
    const name = asStr(course.name).trim();
    if (!name) return null;
    const startPeriod = clampInt(course.startPeriod, 1, maxPeriod, 1);
    const endPeriod = clampInt(course.endPeriod, startPeriod, maxPeriod, startPeriod);
    return {
      id: asStr(course.id) || uid(),
      name,
      location: asStr(course.location).trim(),
      weekday: clampInt(course.weekday, 1, 7, 1),
      startPeriod,
      endPeriod,
      weeks: asStr(course.weeks).trim() || '1-16',
      pattern: ['all', 'odd', 'even'].includes(course.pattern) ? course.pattern : 'all'
    };
  }

  function sanitizeGoal(goal) {
    if (!goal || typeof goal !== 'object') return null;
    const title = asStr(goal.title).trim();
    if (!title) return null;
    const sanitizeItems = items => listOf(items).map(item => {
      if (!item || typeof item !== 'object') return null;
      const text = asStr(item.title).trim();
      if (!text) return null;
      return { id: asStr(item.id) || uid(), title: text, done: item.done === true };
    }).filter(Boolean);
    return {
      id: asStr(goal.id) || uid(),
      title,
      motivation: asStr(goal.motivation || goal.detail).trim(),
      due: parseDay(goal.due) ? goal.due : '',
      milestones: sanitizeItems(goal.milestones),
      actions: sanitizeItems(goal.actions),
      createdAt: Number(goal.createdAt) || Date.now()
    };
  }

  function sanitizeExercises(value) {
    return listOf(value).map(exercise => {
      if (typeof exercise === 'string') {
        const name = exercise.trim();
        return name ? { name, weight: '', reps: '', sets: '' } : null;
      }
      if (!exercise || typeof exercise !== 'object') return null;
      const name = asStr(exercise.name).trim();
      if (!name) return null;
      return {
        name,
        weight: numStr(exercise.weight),
        reps: numStr(exercise.reps),
        sets: numStr(exercise.sets)
      };
    }).filter(Boolean);
  }

  function sanitizeWorkout(workout) {
    if (!workout || typeof workout !== 'object') return null;
    const exercises = sanitizeExercises(workout.exercises);
    if (workout.kind === 'plan') {
      const name = asStr(workout.name).trim();
      if (!name) return null;
      return {
        id: asStr(workout.id) || uid(),
        kind: 'plan',
        name,
        exercises,
        createdAt: Number(workout.createdAt) || Date.now()
      };
    }
    const planName = asStr(workout.planName || workout.name).trim();
    if (!planName && !exercises.length) return null;
    return {
      id: asStr(workout.id) || uid(),
      kind: 'log',
      date: parseDay(workout.date) ? workout.date : todayStr(),
      planName: planName || '训练记录',
      exercises,
      createdAt: Number(workout.createdAt) || Date.now()
    };
  }

  function sanitizeActivity(activity) {
    if (!activity || typeof activity !== 'object') return null;
    const title = asStr(activity.title).trim();
    if (!title) return null;
    const checklist = listOf(activity.checklist).map(item => {
      if (!item || typeof item !== 'object') return null;
      const text = asStr(item.title).trim();
      if (!text) return null;
      return { id: asStr(item.id) || uid(), title: text, done: item.done === true };
    }).filter(Boolean);
    return {
      id: asStr(activity.id) || uid(),
      title,
      category: asStr(activity.category).trim() || '其他',
      date: parseDay(activity.date) ? activity.date : todayStr(),
      status: ACTIVITY_STATUS.includes(activity.status) ? activity.status : '报名',
      notes: asStr(activity.notes),
      checklist
    };
  }

  function sanitizeBook(book) {
    if (!book || typeof book !== 'object') return null;
    const title = asStr(book.title).trim();
    if (!title) return null;
    const totalPages = clampInt(book.totalPages, 0, 99999, 0);
    let pagesRead = clampInt(book.pagesRead, 0, 99999, 0);
    if (totalPages > 0) pagesRead = Math.min(pagesRead, totalPages);
    return {
      id: asStr(book.id) || uid(),
      title,
      author: asStr(book.author).trim(),
      totalPages,
      pagesRead,
      status: READING_STATUS.includes(book.status) ? book.status : '想读',
      notes: asStr(book.notes),
      updatedAt: Number(book.updatedAt) || Date.now()
    };
  }

  function normalizeState(raw) {
    const next = defaultState();
    const rawSettings = raw && typeof raw === 'object' && raw.settings && typeof raw.settings === 'object'
      ? raw.settings
      : null;

    if (rawSettings) {
      if (parseDay(rawSettings.termStart)) next.settings.termStart = rawSettings.termStart;
      if (Number.isInteger(rawSettings.weeks) && rawSettings.weeks >= 1 && rawSettings.weeks <= 52) {
        next.settings.weeks = rawSettings.weeks;
      }
      if (Array.isArray(rawSettings.periods) && rawSettings.periods.length >= 1 && rawSettings.periods.length <= 20) {
        const periods = [];
        let ok = true;
        for (const period of rawSettings.periods) {
          if (!period || typeof period !== 'object') { ok = false; break; }
          const start = asStr(period.start);
          const end = asStr(period.end);
          if (!isValidTime(start) || !isValidTime(end) || timeMinutes(start) >= timeMinutes(end)) { ok = false; break; }
          periods.push({ start, end });
        }
        if (ok && periods.length) next.settings.periods = periods;
      }
    }

    const maxPeriod = next.settings.periods.length;
    next.courses = dedupeIds(listOf(raw && raw.courses).map(course => sanitizeCourse(course, maxPeriod)).filter(Boolean));
    next.goals = dedupeIds(listOf(raw && raw.goals).map(sanitizeGoal).filter(Boolean));
    next.workouts = dedupeIds(listOf(raw && raw.workouts).map(sanitizeWorkout).filter(Boolean));
    next.activities = dedupeIds(listOf(raw && raw.activities).map(sanitizeActivity).filter(Boolean));
    next.books = dedupeIds(listOf(raw && raw.books).map(sanitizeBook).filter(Boolean));
    return next;
  }

  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return { state: defaultState(), error: '浏览器禁止了本地存储，数据只能暂时保存在内存中。' };
    }
    if (raw == null) return { state: defaultState(), error: '' };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { state: defaultState(), error: '本机保存的内容不是有效的 JSON，可能已经损坏。' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== VERSION) {
      return { state: defaultState(), error: '数据版本不受支持或格式不正确（需要 version 1）。' };
    }
    return { state: normalizeState(parsed), error: '' };
  }

  function save() {
    if (corrupt) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      toast('保存失败：浏览器存储不可用或空间已满', 'error');
      return false;
    }
  }

  // 修改数据 -> 保存 -> 重绘。很多轻量操作共用这个入口。
  function commit(mutator, successMessage) {
    if (corrupt) {
      toast('数据无法读取，请先导入备份或重置数据', 'error');
      return false;
    }
    mutator();
    const ok = save();
    render();
    if (ok && successMessage) toast(successMessage);
    return ok;
  }

  /* ======================================================================
     五、业务计算：教学周、课程、目标、训练、活动、阅读
     ====================================================================== */

  function periods() { return state.settings.periods; }

  function currentWeek(dateStr) {
    const start = dayIndex(state.settings.termStart);
    const index = dayIndex(dateStr || todayStr());
    if (start == null || index == null) return null;
    const diff = index - start;
    if (diff < 0 || diff >= state.settings.weeks * 7) return null;
    return Math.floor(diff / 7) + 1;
  }

  function weekStartDate(week) {
    const start = dayIndex(state.settings.termStart);
    if (start == null) return null;
    return dateStrFromIndex(start + (week - 1) * 7);
  }

  function weekDates(week) {
    const monday = weekStartDate(week);
    if (!monday) return [];
    const today = todayStr();
    return WEEKDAYS.map((label, index) => {
      const date = addDays(monday, index);
      return { weekday: index + 1, date, md: fmtDateShort(date), isToday: date === today };
    });
  }

  // 解析 "1-16" / "1,3,5" / "第1-16周" 等写法；非法返回 null。
  function parseWeeks(text, maxWeek) {
    const normalized = String(text || '')
      .replace(/[，、；;]/g, ',')
      .replace(/[—–~～]/g, '-')
      .replace(/第/g, '')
      .replace(/周/g, '')
      .replace(/\s+/g, '');
    if (!normalized) return null;
    const set = new Set();
    for (const token of normalized.split(',')) {
      if (!token) continue;
      const match = /^(\d+)(?:-(\d+))?$/.exec(token);
      if (!match) return null;
      const first = Number(match[1]);
      const last = match[2] ? Number(match[2]) : first;
      if (first < 1 || last < first || last > maxWeek) return null;
      for (let week = first; week <= last; week++) set.add(week);
    }
    return set.size ? set : null;
  }

  // 某门课在学期内周次与单双周过滤后的周次集合；非法/无交集返回 null。
  function courseWeekSet(course) {
    const all = parseWeeks(course.weeks, state.settings.weeks);
    if (!all) return null;
    if (course.pattern === 'all' || !course.pattern) return all;
    const wantOdd = course.pattern === 'odd';
    const set = new Set();
    for (const week of all) {
      if ((week % 2 === 1) === wantOdd) set.add(week);
    }
    return set.size ? set : null;
  }

  function courseTimeLabel(course) {
    const start = periods()[course.startPeriod - 1];
    const end = periods()[course.endPeriod - 1];
    if (!start || !end) return '节次待修正';
    return start.start + '–' + end.end;
  }

  function sortCourses(list) {
    return [...list].sort((a, b) => a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function coursesForDay(weekday, week) {
    return sortCourses(state.courses.filter(course => {
      if (course.weekday !== weekday) return false;
      const weeks = courseWeekSet(course);
      return !!weeks && weeks.has(week);
    }));
  }

  // 把一门课拆成周视图里的块；时间冲突的课作为「冲突提示」挂在第一个块上，避免 rowspan 打架。
  function layoutDay(list) {
    const sorted = sortCourses(list);
    const blocks = [];
    let coveredUntil = 0;
    for (const course of sorted) {
      if (course.startPeriod > coveredUntil) {
        blocks.push({
          course,
          span: Math.max(1, course.endPeriod - course.startPeriod + 1),
          extras: []
        });
        coveredUntil = course.endPeriod;
      } else {
        const host = blocks.find(block =>
          block.course.startPeriod <= course.startPeriod && block.course.endPeriod >= course.startPeriod
        ) || blocks[blocks.length - 1];
        if (host) host.extras.push(course);
      }
    }
    const starts = new Map();
    const covered = new Set();
    for (const block of blocks) {
      starts.set(block.course.startPeriod, block);
      for (let period = block.course.startPeriod; period <= block.course.endPeriod; period++) covered.add(period);
    }
    return { blocks, starts, covered };
  }

  function goalStats(goal) {
    const milestones = goal.milestones || [];
    const actions = goal.actions || [];
    const items = [...milestones, ...actions];
    const total = items.length;
    const done = items.filter(item => item.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    let status = '未开始';
    if (total > 0 && done === total) status = '已完成';
    else if (done > 0) status = '进行中';
    return {
      total,
      done,
      pct,
      status,
      milestones,
      actions,
      milestoneDone: milestones.filter(item => item.done).length,
      actionDone: actions.filter(item => item.done).length
    };
  }

  function workoutPlans() {
    return state.workouts.filter(item => item.kind === 'plan');
  }

  function workoutLogs() {
    return state.workouts
      .filter(item => item.kind === 'log')
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        return dateCompare || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
      });
  }

  function weekLogCount() {
    const monday = todayIndex() - (weekdayOf(todayStr()) - 1);
    return workoutLogs().filter(log => {
      const index = dayIndex(log.date);
      return index != null && index >= monday && index < monday + 7;
    }).length;
  }

  function workoutVolume(log) {
    let total = 0;
    let hasValue = false;
    for (const exercise of log.exercises || []) {
      if (exercise.weight === '' || exercise.reps === '' || exercise.sets === '') continue;
      const weight = Number(exercise.weight);
      const reps = Number(exercise.reps);
      const sets = Number(exercise.sets);
      if (Number.isFinite(weight) && Number.isFinite(reps) && Number.isFinite(sets)) {
        total += weight * reps * sets;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
  }

  function exerciseMetrics(exercise) {
    const weight = exercise.weight !== '' ? exercise.weight + ' kg' : '自重/未填';
    const reps = exercise.reps !== '' ? exercise.reps + ' 次' : '—';
    const sets = exercise.sets !== '' ? exercise.sets + ' 组' : '—';
    return weight + ' × ' + reps + ' × ' + sets;
  }

  function exerciseDefaults(exercise) {
    const parts = [];
    if (exercise.weight !== '') parts.push(exercise.weight + ' kg');
    if (exercise.reps !== '') parts.push(exercise.reps + ' 次');
    if (exercise.sets !== '') parts.push(exercise.sets + ' 组');
    return parts.length ? parts.join(' × ') : '按实际完成记录';
  }

  function nearestActivities(limit) {
    const today = todayIndex();
    const list = state.activities.filter(activity => dayIndex(activity.date) != null);
    const upcoming = list
      .filter(activity => dayIndex(activity.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = list
      .filter(activity => dayIndex(activity.date) < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    return upcoming.concat(past).slice(0, limit).sort((a, b) => a.date.localeCompare(b.date));
  }

  function bookStats(book) {
    const total = Math.max(0, Number(book.totalPages) || 0);
    const read = Math.max(0, Number(book.pagesRead) || 0);
    const capped = total > 0 ? Math.min(read, total) : read;
    const pct = total > 0 ? Math.round((capped / total) * 100) : 0;
    return { total, read: capped, pct };
  }

  function goalStatusClass(status) {
    if (status === '已完成') return '';
    if (status === '进行中') return 'blue';
    return 'plain';
  }

  function activityStatusClass(status) {
    if (status === '已结束') return '';
    if (status === '参加') return 'blue';
    return 'plain';
  }

  function readingStatusClass(status) {
    if (status === '已读完') return '';
    if (status === '在读') return 'blue';
    return 'plain';
  }

  /* ======================================================================
     六、渲染：公共片段
     ====================================================================== */

  function barHTML(pct, label) {
    const value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<div class="bar" role="progressbar" aria-label="' + esc(label) +
      '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value +
      '" data-progress="' + value + '"><i></i></div>';
  }

  function barLine(pct, label) {
    const value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<div class="bar-line">' + barHTML(value, label) + '<strong>' + value + '%</strong></div>';
  }

  function emptyHTML(iconName, title, text, href, linkLabel) {
    return '<div class="empty">' +
      '<span class="empty-icon">' + icon(iconName) + '</span>' +
      '<strong>' + esc(title) + '</strong>' +
      '<p>' + esc(text) + '</p>' +
      (href ? '<a class="btn small" href="' + href + '">' + esc(linkLabel) + '</a>' : '') +
      '</div>';
  }

  function applyProgress(root) {
    root.querySelectorAll('[data-progress]').forEach(bar => {
      const value = Math.max(0, Math.min(100, Number(bar.dataset.progress) || 0));
      const fill = bar.querySelector('i');
      if (fill) fill.style.setProperty('--p', value + '%');
      bar.setAttribute('aria-valuenow', String(value));
    });
  }

  function renderTabs() {
    tabsEl.querySelectorAll('a[data-tab]').forEach(link => {
      const isActive = link.dataset.tab === activeTab;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderWarning() {
    if (!corrupt) {
      warningEl.hidden = true;
      warningEl.innerHTML = '';
      return;
    }
    warningEl.hidden = false;
    warningEl.innerHTML =
      '<div class="banner danger" role="alert">' +
        '<div class="banner-icon">' + icon('warn') + '</div>' +
        '<div class="grow"><strong>数据无法读取</strong><p>' + esc(corruptMessage) +
          ' 可导入备份或重置数据，本机原有内容不会被自动清空。</p></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" data-action="import-data">导入备份</button>' +
          '<button type="button" class="btn danger" data-action="reset-data">重置数据</button>' +
        '</div>' +
      '</div>';
  }

  function render() {
    renderTabs();
    renderWarning();
    const renderers = {
      overview: renderOverview,
      courses: renderCourses,
      goals: renderGoals,
      workouts: renderWorkouts,
      activities: renderActivities,
      reading: renderReading
    };
    const renderer = renderers[activeTab] || renderOverview;
    mainEl.innerHTML = renderer();
    applyProgress(mainEl);
    const tab = TABS.find(item => item.id === activeTab);
    document.title = '晴空物语 · ' + (tab ? tab.label : '概览');
  }

  /* ======================================================================
     七、渲染：概览
     ====================================================================== */

  function renderOverview() {
    const today = todayStr();
    const week = currentWeek(today);
    const weekday = weekdayOf(today);
    const todays = week ? coursesForDay(weekday, week) : [];
    const logs = workoutLogs();
    const todayLog = logs.find(log => log.date === today) || null;
    const lastLog = todayLog || logs[0] || null;
    const activeGoals = state.goals.filter(goal => goalStats(goal).status === '进行中').length;
    const nearest = nearestActivities(3);
    const readingBooks = state.books
      .filter(book => book.status === '在读')
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))
      .slice(0, 2);

    return '' +
      '<section class="today-banner">' +
        '<div class="today-main">' +
          '<span class="today-eyebrow">' + icon('spark') + ' 今天</span>' +
          '<h2>' + esc(fmtDateCN(today)) + '</h2>' +
          '<p class="today-sub">' + (week
            ? '第 ' + week + ' 教学周 · ' + (week % 2 === 1 ? '单周' : '双周') + ' · 今天 ' + todays.length + ' 节课'
            : '当前不在教学周内，去课程表检查学期设置') + '</p>' +
        '</div>' +
        '<div class="today-stats">' +
          '<div class="today-stat"><strong>' + todays.length + '</strong><span>今日课程</span></div>' +
          '<div class="today-stat"><strong>' + weekLogCount() + '</strong><span>本周训练</span></div>' +
          '<div class="today-stat"><strong>' + activeGoals + '</strong><span>进行中目标</span></div>' +
        '</div>' +
      '</section>' +
      '<div class="overview-grid">' +
        '<section class="card card-wide">' +
          '<div class="card-head"><h3>' + icon('calendar') + ' 今日课程</h3><a class="text-link" href="#courses">完整课表 →</a></div>' +
          overviewCoursesBody(week, todays) +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>' + icon('dumbbell') + ' 训练</h3><a class="text-link" href="#workouts">全部记录 →</a></div>' +
          overviewTrainingBody(lastLog, today) +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>' + icon('target') + ' 目标进度</h3><a class="text-link" href="#goals">全部目标 →</a></div>' +
          overviewGoalsBody() +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>' + icon('flag') + ' 最近活动</h3><a class="text-link" href="#activities">全部活动 →</a></div>' +
          overviewActivitiesBody(nearest) +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>' + icon('book') + ' 在读的书</h3><a class="text-link" href="#reading">我的书架 →</a></div>' +
          overviewReadingBody(readingBooks) +
        '</section>' +
      '</div>';
  }

  function overviewCoursesBody(week, todays) {
    if (!week) {
      return emptyHTML('calendar', '当前不在教学周内',
        '请到「课程表」检查第一教学周的周一日期与教学周数；周次和单双周都以教学周为准。',
        '#courses', '去设置学期');
    }
    if (!todays.length) {
      return emptyHTML('spark', '今天没有课',
        '空白日程也很珍贵：可以整理一下这周的目标，或者去读几页书。',
        '#courses', '查看完整课表');
    }
    return '<ul class="course-mini-list">' + todays.map(course => {
      const start = periods()[course.startPeriod - 1];
      const end = periods()[course.endPeriod - 1];
      return '<li class="course-mini">' +
        '<div class="course-mini-time"><strong>' + esc(start ? start.start : '--:--') + '</strong><span>' +
          esc(end ? end.end : '--:--') + '</span></div>' +
        '<div class="grow"><h4>' + esc(course.name) + '</h4><p>' +
          esc(course.location || '地点待补充') + ' · 第 ' + course.startPeriod + '–' + course.endPeriod + ' 节</p></div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function overviewTrainingBody(lastLog, today) {
    if (!lastLog) {
      return emptyHTML('dumbbell', '还没有训练记录',
        '先建一个训练计划，训练结束后记录动作、重量、次数和组数，本周次数会自动统计。',
        '#workouts', '去训练');
    }
    const volume = workoutVolume(lastLog);
    const count = (lastLog.exercises || []).length;
    return '<div class="goal-mini">' +
      '<div class="row"><h4>' + esc(lastLog.planName) + '</h4>' +
        '<span class="tag ' + (lastLog.date === today ? 'blue' : 'plain') + '">' +
        (lastLog.date === today ? '今天已完成' : '最近一次') + '</span></div>' +
      '<p class="muted">' + esc(fmtDateCN(lastLog.date)) + ' · ' + count + ' 个动作' +
        (volume !== null ? ' · 总容量 ' + esc(formatVolume(volume)) + ' kg' : '') + '</p>' +
    '</div>' +
    '<p class="muted">本周已训练 <strong>' + weekLogCount() + '</strong> 次</p>';
  }

  function overviewGoalsBody() {
    const goals = state.goals.slice(0, 2);
    if (!goals.length) {
      return emptyHTML('target', '还没有目标',
        '把一个长期目标拆成「阶段」和「行动」，每完成一项，进度就会前进。',
        '#goals', '添加第一个目标');
    }
    return goals.map(goal => {
      const stats = goalStats(goal);
      return '<div class="goal-mini">' +
        '<div class="row"><h4>' + esc(goal.title) + '</h4>' +
          '<span class="tag ' + goalStatusClass(stats.status) + '">' + stats.status + '</span></div>' +
        barLine(stats.pct, goal.title + ' 完成度') +
        '<p class="muted">' + stats.done + ' / ' + stats.total + ' 项完成' +
          (goal.due ? ' · 截止 ' + esc(goal.due) : '') + '</p>' +
      '</div>';
    }).join('');
  }

  function overviewActivitiesBody(nearest) {
    if (!nearest.length) {
      return emptyHTML('flag', '还没有活动记录',
        '把讲座、比赛、社团活动记下来，报名、准备清单和参与状态都不会忘。',
        '#activities', '添加活动');
    }
    return '<ul class="mini-list">' + nearest.map(activity =>
      '<li class="mini-item">' +
        '<span class="mini-date">' + esc(fmtDateShort(activity.date)) + '</span>' +
        '<div class="grow"><h4>' + esc(activity.title) + '</h4>' +
          '<p>' + esc(activity.category) + ' · ' + esc(activity.status) + '</p></div>' +
      '</li>'
    ).join('') + '</ul>';
  }

  function overviewReadingBody(books) {
    if (!books.length) {
      return emptyHTML('book', '书架还是空的',
        '加入正在读的书，记录页数后这里会显示阅读进度，每点一次「+10 页」都会更新。',
        '#reading', '添加书籍');
    }
    return books.map(book => {
      const stats = bookStats(book);
      return '<div class="goal-mini">' +
        '<div class="row"><h4>' + esc(book.title) + '</h4><span class="tag blue">' + esc(book.status) + '</span></div>' +
        barLine(stats.pct, book.title + ' 阅读进度') +
        '<p class="muted">' + esc(book.author || '作者待补充') + ' · 已读 ' + stats.read + ' / ' +
          (stats.total || '—') + ' 页</p>' +
      '</div>';
    }).join('');
  }

  /* ======================================================================
     八、渲染：课程表
     ====================================================================== */

  function renderCourses() {
    const weeks = state.settings.weeks;
    if (viewWeek == null) viewWeek = currentWeek() || 1;
    viewWeek = Math.max(1, Math.min(weeks, viewWeek));

    return '' +
      '<div class="section-head">' +
        '<div><h2>课程表</h2><p>第一教学周 ' + esc(state.settings.termStart) +
          ' · 共 ' + weeks + ' 周 · 每天 ' + periods().length + ' 节</p></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" data-action="open-settings">' + icon('settings') + ' 学期设置</button>' +
          '<button type="button" class="btn primary" data-action="new-course">' + icon('plus') + ' 添加课程</button>' +
        '</div>' +
      '</div>' +
      renderWeekToolbar(weeks) +
      renderWeekGrid() +
      '<div class="section-head sub"><h3>全部课程<span class="count">' + state.courses.length +
        '</span></h3><span class="muted">周视图按教学周与单双周过滤</span></div>' +
      renderCourseList();
  }

  function renderWeekToolbar(weeks) {
    const week = viewWeek;
    const monday = weekStartDate(week);
    const sunday = monday ? addDays(monday, 6) : null;
    return '<div class="week-toolbar">' +
      '<div class="week-meta">' +
        '<strong>第 ' + week + ' 教学周</strong>' +
        '<span class="tag ' + (week % 2 === 1 ? '' : 'blue') + '">' + (week % 2 === 1 ? '单周' : '双周') + '</span>' +
        '<span class="muted">' + (monday
          ? esc(fmtDateShort(monday)) + ' – ' + esc(fmtDateShort(sunday))
          : '学期日期未设置') + '</span>' +
      '</div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn small" data-action="prev-week" aria-label="查看上一周"' +
          (week <= 1 ? ' disabled' : '') + '>' + icon('chevronLeft') + ' 上一周</button>' +
        '<button type="button" class="btn small" data-action="this-week">回到本周</button>' +
        '<button type="button" class="btn small" data-action="next-week" aria-label="查看下一周"' +
          (week >= weeks ? ' disabled' : '') + '>下一周 ' + icon('chevronRight') + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderWeekGrid() {
    const days = weekDates(viewWeek);
    if (!days.length) return '<div class="card">' + emptyHTML('calendar', '学期日期未设置', '请先设置第一教学周的周一日期。') + '</div>';
    const layouts = days.map(day => layoutDay(coursesForDay(day.weekday, viewWeek)));
    const rows = [];

    for (let period = 1; period <= periods().length; period++) {
      let cells = '';
      days.forEach((day, index) => {
        const layout = layouts[index];
        const block = layout.starts.get(period);
        if (block) {
          cells += '<td class="course-cell' + (day.isToday ? ' today-col' : '') + '" rowspan="' +
            block.span + '">' + courseBlockHTML(block) + '</td>';
        } else if (!layout.covered.has(period)) {
          cells += '<td class="empty-cell' + (day.isToday ? ' today-col' : '') + '"></td>';
        }
      });
      const slot = periods()[period - 1];
      rows.push('<tr><th scope="row" class="period-head"><span>' + period + '</span><small>' +
        esc(slot.start) + '<br>' + esc(slot.end) + '</small></th>' + cells + '</tr>');
    }

    return '<div class="grid-scroll"><table class="week-grid">' +
      '<thead><tr><th scope="col" class="period-head">节次</th>' +
        days.map(day => '<th scope="col" class="day-head' + (day.isToday ? ' today-col' : '') + '">' +
          WEEKDAYS[day.weekday - 1] + '<small>' + esc(day.md) + '</small></th>').join('') +
      '</tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>' +
    '</table></div>';
  }

  function courseBlockHTML(block) {
    const course = block.course;
    const conflicts = block.extras.length
      ? '<span class="conflict-chip" title="时间冲突">' + icon('warn') + ' 与「' +
        esc(block.extras.map(item => item.name).join('、')) + '」冲突</span>'
      : '';
    return '<div class="course-block">' +
      '<strong>' + esc(course.name) + '</strong>' +
      '<span class="course-meta">' + icon('pin') + esc(course.location || '地点待补充') + '</span>' +
      '<span class="course-meta">' + icon('clock') + '第 ' + course.startPeriod + '–' + course.endPeriod + ' 节</span>' +
      conflicts +
    '</div>';
  }

  function renderCourseList() {
    if (!state.courses.length) {
      return emptyHTML('calendar', '课程表还是空的',
        '先设置学期，再添加第一门课；支持 1-16 或 1,3,5 的周次写法，也能按单双周过滤。');
    }
    return state.courses.map(course => {
      const weeks = courseWeekSet(course);
      return '<article class="item-row">' +
        '<div class="item-main">' +
          '<div class="item-title"><strong>' + esc(course.name) + '</strong>' +
            '<span class="tag">' + (PATTERNS[course.pattern] || '每周') + '</span>' +
            (weeks ? '' : '<span class="tag warn">周次超出学期</span>') + '</div>' +
          '<p class="muted">' + WEEKDAYS[course.weekday - 1] + ' · 第 ' + course.startPeriod + '–' +
            course.endPeriod + ' 节 · ' + esc(courseTimeLabel(course)) + ' · ' +
            esc(course.location || '地点待补充') + ' · 周次 ' + esc(course.weeks) + '</p>' +
        '</div>' +
        '<div class="item-actions">' +
          '<button type="button" class="icon-btn" data-action="edit-course" data-id="' + esc(course.id) +
            '" aria-label="编辑课程 ' + esc(course.name) + '">' + icon('edit') + '</button>' +
          '<button type="button" class="icon-btn danger" data-action="delete-course" data-id="' + esc(course.id) +
            '" aria-label="删除课程 ' + esc(course.name) + '">' + icon('trash') + '</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* ======================================================================
     九、渲染：目标
     ====================================================================== */

  function renderGoals() {
    const total = state.goals.length;
    const active = state.goals.filter(goal => goalStats(goal).status === '进行中').length;
    const done = state.goals.filter(goal => goalStats(goal).status === '已完成').length;

    return '<div class="section-head">' +
        '<div><h2>目标</h2><p>把长期目标拆成阶段与行动，每完成一项自动计算进度。</p></div>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-action="new-goal">' +
          icon('plus') + ' 添加目标</button></div>' +
      '</div>' +
      '<div class="week-meta"><span class="tag">共 ' + total + ' 个</span>' +
        '<span class="tag blue">进行中 ' + active + '</span>' +
        '<span class="tag">已完成 ' + done + '</span></div>' +
      (total
        ? state.goals.map(goalCardHTML).join('')
        : emptyHTML('target', '还没有目标', '点击右上角「添加目标」，先写下一个想完成的目标，再拆出可勾选的阶段和行动。'));
  }

  function goalCardHTML(goal) {
    const stats = goalStats(goal);
    return '<section class="card goal-card">' +
      '<div class="card-head">' +
        '<div class="grow"><h3>' + esc(goal.title) + '</h3>' +
          '<p>' + (goal.motivation ? esc(goal.motivation) : '还没有写动机，补充一句会更容易坚持。') +
            (goal.due ? ' · 截止 ' + esc(goal.due) : '') + '</p></div>' +
        '<span class="tag ' + goalStatusClass(stats.status) + '">' + stats.status + '</span>' +
      '</div>' +
      barLine(stats.pct, goal.title + ' 完成度') +
      '<div class="goal-columns">' +
        '<div class="goal-list">' +
          '<h4>阶段<span class="count">' + stats.milestoneDone + '/' + stats.milestones.length + '</span></h4>' +
          '<ul class="check-list">' + (stats.milestones.length
            ? stats.milestones.map(item => goalItemHTML(goal, 'milestone', item)).join('')
            : '<li class="muted">还没有阶段</li>') + '</ul>' +
          '<form class="inline-form" data-form="milestone" data-id="' + esc(goal.id) + '">' +
            '<input name="title" maxlength="80" placeholder="添加一个阶段…" aria-label="为目标添加阶段">' +
            '<button type="submit" class="btn small">' + icon('plus') + ' 添加</button>' +
          '</form>' +
        '</div>' +
        '<div class="goal-list">' +
          '<h4>行动<span class="count">' + stats.actionDone + '/' + stats.actions.length + '</span></h4>' +
          '<ul class="check-list">' + (stats.actions.length
            ? stats.actions.map(item => goalItemHTML(goal, 'action', item)).join('')
            : '<li class="muted">还没有行动</li>') + '</ul>' +
          '<form class="inline-form" data-form="action" data-id="' + esc(goal.id) + '">' +
            '<input name="title" maxlength="80" placeholder="添加一个行动…" aria-label="为目标添加行动">' +
            '<button type="submit" class="btn small">' + icon('plus') + ' 添加</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="item-actions goal-actions">' +
        '<button type="button" class="btn small" data-action="edit-goal" data-id="' + esc(goal.id) + '">' +
          icon('edit') + ' 编辑目标</button>' +
        '<button type="button" class="btn small ghost-danger" data-action="delete-goal" data-id="' + esc(goal.id) + '">' +
          icon('trash') + ' 删除</button>' +
      '</div>' +
    '</section>';
  }

  function goalItemHTML(goal, type, item) {
    return '<li class="check-row">' +
      '<label class="check-label"><input type="checkbox" data-change="toggle-goal-item" data-gid="' +
        esc(goal.id) + '" data-type="' + type + '" data-id="' + esc(item.id) + '"' +
        (item.done ? ' checked' : '') + '><span class="' + (item.done ? 'done' : '') + '">' +
        esc(item.title) + '</span></label>' +
      '<button type="button" class="icon-btn tiny danger" data-action="delete-goal-item" data-gid="' +
        esc(goal.id) + '" data-type="' + type + '" data-id="' + esc(item.id) +
        '" aria-label="删除 ' + esc(item.title) + '">' + icon('close') + '</button>' +
    '</li>';
  }

  /* ======================================================================
     十、渲染：训练
     ====================================================================== */

  function renderWorkouts() {
    const plans = workoutPlans();
    const logs = workoutLogs();
    return '<div class="section-head">' +
        '<div><h2>训练</h2><p>本周已训练 ' + weekLogCount() + ' 次 · 共 ' + logs.length + ' 条完成记录</p></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" data-action="new-plan">' + icon('list') + ' 新建计划</button>' +
          '<button type="button" class="btn primary" data-action="new-log">' + icon('plus') + ' 记录训练</button>' +
        '</div>' +
      '</div>' +
      '<div class="section-head sub"><h3>训练计划<span class="count">' + plans.length + '</span></h3></div>' +
      (plans.length
        ? '<div class="plan-grid">' + plans.map(planCardHTML).join('') + '</div>'
        : emptyHTML('dumbbell', '还没有训练计划',
          '先建一个计划，列出动作和默认重量/次数/组数；训练时可以一键带入，完成后逐项记录实际数据。')) +
      '<div class="section-head sub"><h3>训练记录<span class="count">' + logs.length + '</span></h3></div>' +
      (logs.length
        ? '<div class="log-list">' + logs.map(logCardHTML).join('') + '</div>'
        : emptyHTML('clock', '还没有完成记录',
          '训练结束后点「记录训练」，填写日期、计划名和每个动作的实际重量、次数、组数。'));
  }

  function planCardHTML(plan) {
    const exercises = plan.exercises || [];
    return '<article class="card plan-card">' +
      '<div class="card-head"><h4>' + esc(plan.name) + '</h4>' +
        '<span class="tag">' + exercises.length + ' 个动作</span></div>' +
      '<ul class="exercise-list">' + (exercises.length
        ? exercises.map(exercise => '<li><span>' + esc(exercise.name) + '</span><em>' +
          esc(exerciseDefaults(exercise)) + '</em></li>').join('')
        : '<li class="muted">这个计划还没有动作</li>') + '</ul>' +
      '<div class="item-actions">' +
        '<button type="button" class="btn small primary" data-action="start-log" data-id="' + esc(plan.id) + '">' +
          icon('play') + ' 开始记录</button>' +
        '<button type="button" class="icon-btn" data-action="edit-plan" data-id="' + esc(plan.id) +
          '" aria-label="编辑计划 ' + esc(plan.name) + '">' + icon('edit') + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-plan" data-id="' + esc(plan.id) +
          '" aria-label="删除计划 ' + esc(plan.name) + '">' + icon('trash') + '</button>' +
      '</div>' +
    '</article>';
  }

  function logCardHTML(log) {
    const exercises = log.exercises || [];
    const volume = workoutVolume(log);
    return '<article class="card log-card">' +
      '<div class="card-head">' +
        '<div><h3>' + esc(log.planName) + '</h3><p>' + esc(fmtDateCN(log.date)) + '</p></div>' +
        '<div class="item-actions">' +
          '<span class="tag">' + exercises.length + ' 个动作</span>' +
          '<button type="button" class="icon-btn danger" data-action="delete-log" data-id="' + esc(log.id) +
            '" aria-label="删除 ' + esc(log.date) + ' 的训练记录">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>' +
      (exercises.length
        ? '<ul class="exercise-log-list">' + exercises.map(exercise =>
            '<li><span class="ex-name">' + esc(exercise.name) + '</span><span class="ex-metrics">' +
            esc(exerciseMetrics(exercise)) + '</span></li>').join('') + '</ul>'
        : '<p class="muted">没有动作明细。</p>') +
      (volume !== null
        ? '<p class="muted">总容量 ' + esc(formatVolume(volume)) + ' kg（重量 × 次数 × 组数）</p>'
        : '') +
    '</article>';
  }

  /* ======================================================================
     十一、渲染：活动
     ====================================================================== */

  function renderActivities() {
    const list = [...state.activities].sort((a, b) => a.date.localeCompare(b.date));
    const pending = list.filter(activity => activity.status !== '已结束').length;
    return '<div class="section-head">' +
        '<div><h2>活动</h2><p>讲座、比赛与社团活动按日期排序；准备清单可以逐项勾选。</p></div>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-action="new-activity">' +
          icon('plus') + ' 添加活动</button></div>' +
      '</div>' +
      '<div class="week-meta"><span class="tag">共 ' + list.length + ' 项</span>' +
        '<span class="tag blue">待完成 ' + pending + '</span></div>' +
      (list.length
        ? list.map(activityCardHTML).join('')
        : emptyHTML('flag', '还没有活动记录',
          '把要参加的活动记下来，报名截止、准备事项和参与状态都能一眼看到。'));
  }

  function activityCardHTML(activity) {
    const checklist = activity.checklist || [];
    const done = checklist.filter(item => item.done).length;
    return '<article class="card activity-card' + (activity.status === '已结束' ? ' is-done' : '') + '">' +
      '<div class="card-head">' +
        '<div class="grow">' +
          '<div class="item-title"><span class="tag">' + esc(activity.category) + '</span>' +
            '<span class="tag ' + activityStatusClass(activity.status) + '">' + esc(activity.status) + '</span></div>' +
          '<h3>' + esc(activity.title) + '</h3>' +
          '<p>' + esc(fmtDateCN(activity.date)) +
            (checklist.length ? ' · 准备 ' + done + '/' + checklist.length : '') + '</p>' +
        '</div>' +
        '<div class="item-actions">' +
          (activity.status !== '已结束'
            ? '<button type="button" class="btn small" data-action="complete-activity" data-id="' + esc(activity.id) + '">' +
              icon('check') + ' 标记完成</button>'
            : '') +
          '<button type="button" class="icon-btn" data-action="edit-activity" data-id="' + esc(activity.id) +
            '" aria-label="编辑活动 ' + esc(activity.title) + '">' + icon('edit') + '</button>' +
          '<button type="button" class="icon-btn danger" data-action="delete-activity" data-id="' + esc(activity.id) +
            '" aria-label="删除活动 ' + esc(activity.title) + '">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>' +
      (activity.notes ? '<p class="note-text">' + esc(activity.notes) + '</p>' : '') +
      '<div class="check-block">' +
        '<h4>准备清单<span class="count">' + done + '/' + checklist.length + '</span></h4>' +
        '<ul class="check-list">' + (checklist.length
          ? checklist.map(item => '<li class="check-row">' +
              '<label class="check-label"><input type="checkbox" data-change="toggle-checklist" data-id="' +
                esc(activity.id) + '" data-item="' + esc(item.id) + '"' +
                (item.done ? ' checked' : '') + '><span class="' + (item.done ? 'done' : '') + '">' +
                esc(item.title) + '</span></label>' +
              '<button type="button" class="icon-btn tiny danger" data-action="delete-checklist" data-id="' +
                esc(activity.id) + '" data-item="' + esc(item.id) + '" aria-label="删除准备项 ' +
                esc(item.title) + '">' + icon('close') + '</button>' +
            '</li>').join('')
          : '<li class="muted">还没有准备事项</li>') + '</ul>' +
        '<form class="inline-form" data-form="checklist" data-id="' + esc(activity.id) + '">' +
          '<input name="title" maxlength="80" placeholder="添加准备事项…" aria-label="为活动添加准备事项">' +
          '<button type="submit" class="btn small">' + icon('plus') + ' 添加</button>' +
        '</form>' +
      '</div>' +
    '</article>';
  }

  /* ======================================================================
     十二、渲染：阅读
     ====================================================================== */

  function renderReading() {
    const books = [...state.books].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    const reading = books.filter(book => book.status === '在读').length;
    const finished = books.filter(book => book.status === '已读完').length;
    return '<div class="section-head">' +
        '<div><h2>阅读</h2><p>书单按最近更新排序，记录页数后自动计算进度。</p></div>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-action="new-book">' +
          icon('plus') + ' 添加书籍</button></div>' +
      '</div>' +
      '<div class="week-meta"><span class="tag">共 ' + books.length + ' 本</span>' +
        '<span class="tag blue">在读 ' + reading + '</span>' +
        '<span class="tag">已读完 ' + finished + '</span></div>' +
      (books.length
        ? '<div class="book-grid">' + books.map(bookCardHTML).join('') + '</div>'
        : emptyHTML('book', '书架还是空的',
          '添加正在读或想读的书，填写总页数与已读页数，阅读进度会显示在这里。'));
  }

  function bookCardHTML(book) {
    const stats = bookStats(book);
    return '<article class="card book-card">' +
      '<div class="card-head">' +
        '<div class="grow"><h3>' + esc(book.title) + '</h3><p>' + esc(book.author || '作者待补充') + '</p></div>' +
        '<span class="tag ' + readingStatusClass(book.status) + '">' + esc(book.status) + '</span>' +
      '</div>' +
      barLine(stats.pct, book.title + ' 阅读进度') +
      '<p class="muted">已读 ' + stats.read + ' / ' + (stats.total || '—') + ' 页' +
        (stats.total ? ' · ' + stats.pct + '%' : '') + '</p>' +
      (book.notes ? '<p class="note-text">' + esc(book.notes) + '</p>' : '') +
      '<div class="item-actions">' +
        '<button type="button" class="btn small" data-action="read-10" data-id="' + esc(book.id) + '"' +
          (stats.total > 0 && stats.read >= stats.total ? ' disabled' : '') + '>' +
          icon('plus') + ' 10 页</button>' +
        '<button type="button" class="btn small" data-action="edit-book" data-id="' + esc(book.id) + '">' +
          icon('edit') + ' 编辑</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-book" data-id="' + esc(book.id) +
          '" aria-label="删除书籍 ' + esc(book.title) + '">' + icon('trash') + '</button>' +
      '</div>' +
    '</article>';
  }

  /* ======================================================================
     十三、弹窗基座与通用表单工具
     ====================================================================== */

  function openDialog(options) {
    const { title, body, submitLabel = '保存', onSubmit, wide = false } = options;
    dialogTitleEl.textContent = title;
    dialogBodyEl.innerHTML =
      '<form id="dialog-form" class="dialog-form" novalidate>' +
        '<div class="form-body">' + body + '</div>' +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<div class="dialog-actions">' +
          '<button type="button" class="btn" data-action="close-dialog">取消</button>' +
          '<button type="submit" class="btn primary">' + esc(submitLabel) + '</button>' +
        '</div>' +
      '</form>';
    dialogEl.classList.toggle('wide', wide);
    dialogSubmit = onSubmit;
    dialogEl.showModal();
    const focusTarget = dialogBodyEl.querySelector(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    );
    if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
  }

  function showFormError(message) {
    const error = document.getElementById('form-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function val(form, name) {
    const field = form.elements.namedItem(name);
    return field && 'value' in field ? String(field.value).trim() : '';
  }

  function periodOptions(selected, count) {
    let html = '';
    for (let index = 1; index <= count; index++) {
      html += '<option value="' + index + '"' + (index === selected ? ' selected' : '') + '>第 ' + index + ' 节</option>';
    }
    return html;
  }

  function emptyExercise() {
    return { name: '', weight: '', reps: '', sets: '' };
  }

  function exerciseRowHTML(exercise) {
    const item = exercise || emptyExercise();
    return '<div class="repeat-row exercise-row">' +
      '<label class="field compact ex-name-field"><span>动作</span>' +
        '<input data-field="name" value="' + esc(item.name) + '" maxlength="40" placeholder="如：卧推" aria-label="动作名称"></label>' +
      '<label class="field compact"><span>重量 kg</span>' +
        '<input data-field="weight" value="' + esc(item.weight) + '" inputmode="decimal" placeholder="60" aria-label="重量（kg）"></label>' +
      '<label class="field compact"><span>次数</span>' +
        '<input data-field="reps" value="' + esc(item.reps) + '" inputmode="numeric" placeholder="8" aria-label="次数"></label>' +
      '<label class="field compact"><span>组数</span>' +
        '<input data-field="sets" value="' + esc(item.sets) + '" inputmode="numeric" placeholder="3" aria-label="组数"></label>' +
      '<button type="button" class="icon-btn tiny row-remove" data-action="remove-row" aria-label="删除这个动作">' +
        icon('close') + '</button>' +
    '</div>';
  }

  function collectExercises(form) {
    return [...form.querySelectorAll('#exercise-rows .repeat-row')].map(row => {
      const read = field => {
        const input = row.querySelector('[data-field="' + field + '"]');
        return input ? String(input.value).trim() : '';
      };
      return { name: read('name'), weight: read('weight'), reps: read('reps'), sets: read('sets') };
    }).filter(exercise => exercise.name || exercise.weight || exercise.reps || exercise.sets);
  }

  function validateExercises(exercises) {
    for (let index = 0; index < exercises.length; index++) {
      const exercise = exercises[index];
      if (!exercise.name) return '第 ' + (index + 1) + ' 个动作还没有名称。';
      if (exercise.weight !== '') {
        const weight = Number(exercise.weight);
        if (!Number.isFinite(weight) || weight < 0) return '第 ' + (index + 1) + ' 个动作的重量需为不小于 0 的数字。';
      }
      if (exercise.reps !== '') {
        const reps = Number(exercise.reps);
        if (!Number.isInteger(reps) || reps < 1) return '第 ' + (index + 1) + ' 个动作的次数需为正整数。';
      }
      if (exercise.sets !== '') {
        const sets = Number(exercise.sets);
        if (!Number.isInteger(sets) || sets < 1) return '第 ' + (index + 1) + ' 个动作的组数需为正整数。';
      }
    }
    return null;
  }

  function addExerciseRow() {
    const box = document.getElementById('exercise-rows');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', exerciseRowHTML(emptyExercise()));
    const rows = box.querySelectorAll('.repeat-row');
    const last = rows[rows.length - 1];
    if (last) {
      const input = last.querySelector('[data-field="name"]');
      if (input) input.focus();
    }
  }

  /* ======================================================================
     十四、弹窗：学期设置 / 课程 / 目标 / 计划 / 记录 / 活动 / 书籍
     ====================================================================== */

  function periodRowsHTML(list) {
    return list.map((period, index) =>
      '<div class="repeat-row period-row">' +
        '<span class="row-index">第 ' + (index + 1) + ' 节</span>' +
        '<label class="field compact"><span>开始</span><input type="time" data-field="start" value="' +
          esc(period.start) + '" aria-label="第 ' + (index + 1) + ' 节开始时间"></label>' +
        '<label class="field compact"><span>结束</span><input type="time" data-field="end" value="' +
          esc(period.end) + '" aria-label="第 ' + (index + 1) + ' 节结束时间"></label>' +
      '</div>'
    ).join('');
  }

  function syncPeriodRows(count) {
    const box = document.getElementById('period-rows');
    const countInput = document.querySelector('#dialog-form [name="periodCount"]');
    if (!box) return;
    const oldRows = [...box.querySelectorAll('.period-row')].map(row => ({
      start: (row.querySelector('[data-field="start"]') || {}).value || '',
      end: (row.querySelector('[data-field="end"]') || {}).value || ''
    }));
    const safeCount = Math.max(1, Math.min(20, Number(count) || 1));
    if (countInput && Number(countInput.value) !== safeCount) countInput.value = String(safeCount);
    const list = [];
    for (let index = 0; index < safeCount; index++) {
      const fallback = DEFAULT_PERIODS[index] || DEFAULT_PERIODS[DEFAULT_PERIODS.length - 1];
      const previous = oldRows[index];
      list.push({
        start: isValidTime(previous && previous.start) ? previous.start : fallback.start,
        end: isValidTime(previous && previous.end) ? previous.end : fallback.end
      });
    }
    box.innerHTML = periodRowsHTML(list);
  }

  function openSettingsDialog() {
    const settings = state.settings;
    const body =
      '<label class="field"><span>第一教学周周一</span>' +
        '<input type="date" name="termStart" value="' + esc(settings.termStart) + '" required></label>' +
      '<div class="field-grid">' +
        '<label class="field"><span>教学周数</span>' +
          '<input type="number" name="weeks" min="1" max="52" step="1" value="' + settings.weeks + '" required></label>' +
        '<label class="field"><span>每天节次数量</span>' +
          '<input type="number" name="periodCount" min="1" max="20" step="1" value="' +
          settings.periods.length + '" required></label>' +
      '</div>' +
      '<div class="repeat-head"><strong>节次时间</strong>' +
        '<button type="button" class="btn small" data-action="default-periods">恢复默认 12 节模板</button></div>' +
      '<div id="period-rows" class="repeater">' + periodRowsHTML(settings.periods) + '</div>' +
      '<p class="hint">第一教学周必须从周一开始。调整节次数量后，超出新范围的开课节次会被收拢到最后一节，请检查课程。</p>';

    openDialog({
      title: '学期设置',
      body,
      submitLabel: '保存设置',
      wide: true,
      onSubmit(form) {
        const termStart = val(form, 'termStart');
        if (!parseDay(termStart)) return '请选择第一教学周的周一日期。';
        if (weekdayOf(termStart) !== 1) return '第一教学周的开始日期必须是周一。';
        const weeks = Number(val(form, 'weeks'));
        if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) return '教学周数需为 1—52 之间的整数。';
        const count = Number(val(form, 'periodCount'));
        if (!Number.isInteger(count) || count < 1 || count > 20) return '节次数量需为 1—20 之间的整数。';

        const rows = [...form.querySelectorAll('#period-rows .period-row')];
        const nextPeriods = [];
        for (let index = 0; index < count; index++) {
          const row = rows[index];
          const start = row ? (row.querySelector('[data-field="start"]') || {}).value || '' : '';
          const end = row ? (row.querySelector('[data-field="end"]') || {}).value || '' : '';
          const fallback = DEFAULT_PERIODS[index] || DEFAULT_PERIODS[DEFAULT_PERIODS.length - 1];
          if (row && !isValidTime(start)) return '第 ' + (index + 1) + ' 节的开始时间格式不正确。';
          if (row && !isValidTime(end)) return '第 ' + (index + 1) + ' 节的结束时间格式不正确。';
          const startTime = row ? start : fallback.start;
          const endTime = row ? end : fallback.end;
          if (timeMinutes(startTime) >= timeMinutes(endTime)) return '第 ' + (index + 1) + ' 节的结束时间必须晚于开始时间。';
          if (nextPeriods.length && timeMinutes(startTime) < timeMinutes(nextPeriods[nextPeriods.length - 1].end)) {
            return '第 ' + (index + 1) + ' 节与上一节时间重叠。';
          }
          nextPeriods.push({ start: startTime, end: endTime });
        }

        state.settings.termStart = termStart;
        state.settings.weeks = weeks;
        state.settings.periods = nextPeriods;
        // 节次数量变少时，把越界课程收拢到有效范围，避免周视图 rowspan 溢出
        state.courses.forEach(course => {
          if (course.startPeriod > count) course.startPeriod = count;
          if (course.endPeriod > count) course.endPeriod = count;
          if (course.endPeriod < course.startPeriod) course.endPeriod = course.startPeriod;
        });
        save();
        viewWeek = null;
        render();
        const broken = state.courses.filter(course => !courseWeekSet(course)).length;
        toast(broken
          ? '设置已保存；' + broken + ' 门课程的周次超出学期范围，请检查'
          : '学期设置已保存', broken ? 'error' : '');
        return null;
      }
    });
  }

  function resetDefaultPeriods() {
    syncPeriodRows(DEFAULT_PERIODS.length);
  }

  function openCourseDialog(course) {
    const editing = !!course;
    const current = course || {
      name: '', location: '', weekday: 1, startPeriod: 1, endPeriod: 2, weeks: '1-16', pattern: 'all'
    };
    const count = periods().length;
    const body =
      '<label class="field"><span>课程名称</span>' +
        '<input name="name" value="' + esc(current.name) + '" maxlength="60" placeholder="如：高等数学" required></label>' +
      '<div class="field-grid">' +
        '<label class="field"><span>地点</span>' +
          '<input name="location" value="' + esc(current.location) + '" maxlength="60" placeholder="如：北楼 203"></label>' +
        '<label class="field"><span>星期</span><select name="weekday">' +
          WEEKDAYS.map((label, index) => '<option value="' + (index + 1) + '"' +
            (index + 1 === current.weekday ? ' selected' : '') + '>' + label + '</option>').join('') +
        '</select></label>' +
        '<label class="field"><span>开始节次</span><select name="startPeriod">' +
          periodOptions(current.startPeriod, count) + '</select></label>' +
        '<label class="field"><span>结束节次</span><select name="endPeriod">' +
          periodOptions(current.endPeriod, count) + '</select></label>' +
      '</div>' +
      '<div class="field-grid">' +
        '<label class="field"><span>周次</span>' +
          '<input name="weeks" value="' + esc(current.weeks) + '" maxlength="60" placeholder="1-16 或 1,3,5" required></label>' +
        '<label class="field"><span>单双周</span><select name="pattern">' +
          Object.keys(PATTERNS).map(key => '<option value="' + key + '"' +
            (key === current.pattern ? ' selected' : '') + '>' + PATTERNS[key] + '</option>').join('') +
        '</select></label>' +
      '</div>' +
      '<p class="hint">周次支持 1-16、1,3,5 等写法；单双周按教学周计算。当前学期共 ' +
        state.settings.weeks + ' 周、每天 ' + count + ' 节。</p>';

    openDialog({
      title: editing ? '编辑课程' : '添加课程',
      body,
      submitLabel: editing ? '保存修改' : '添加课程',
      onSubmit(form) {
        const name = val(form, 'name');
        if (!name) return '请输入课程名称。';
        const startPeriod = Number(val(form, 'startPeriod'));
        const endPeriod = Number(val(form, 'endPeriod'));
        if (endPeriod < startPeriod) return '结束节次不能早于开始节次。';
        const weeksText = val(form, 'weeks');
        const weekSet = parseWeeks(weeksText, state.settings.weeks);
        if (!weekSet) {
          return '周次格式不正确，请填写 1—' + state.settings.weeks + ' 范围内的数字，如 1-16 或 1,3,5。';
        }
        const pattern = val(form, 'pattern');
        const filtered = [...weekSet].filter(week =>
          pattern === 'all' || (pattern === 'odd' ? week % 2 === 1 : week % 2 === 0)
        );
        if (!filtered.length) return '周次与单双周规则没有交集，请调整。';
        const data = {
          name,
          location: val(form, 'location'),
          weekday: Number(val(form, 'weekday')),
          startPeriod,
          endPeriod,
          weeks: weeksText,
          pattern
        };
        if (editing) Object.assign(course, data);
        else state.courses.unshift(Object.assign({ id: uid() }, data));
        save();
        render();
        toast(editing ? '课程已更新' : '课程已添加');
        return null;
      }
    });
  }

  function openGoalDialog(goal) {
    const editing = !!goal;
    const current = goal || { title: '', motivation: '', due: '' };
    const body =
      '<label class="field"><span>目标标题</span>' +
        '<input name="title" value="' + esc(current.title) + '" maxlength="80" placeholder="如：通过英语六级" required></label>' +
      '<label class="field"><span>动机 / 说明</span>' +
        '<textarea name="motivation" maxlength="500" placeholder="为什么想完成它？完成后会怎样？">' +
        esc(current.motivation) + '</textarea></label>' +
      '<label class="field"><span>截止日期（可选）</span>' +
        '<input type="date" name="due" value="' + esc(current.due) + '"></label>';

    openDialog({
      title: editing ? '编辑目标' : '添加目标',
      body,
      submitLabel: editing ? '保存修改' : '添加目标',
      onSubmit(form) {
        const title = val(form, 'title');
        if (!title) return '请输入目标标题。';
        const motivation = val(form, 'motivation');
        const due = val(form, 'due');
        if (due && !parseDay(due)) return '截止日期格式不正确。';
        if (editing) {
          Object.assign(goal, { title, motivation, due });
        } else {
          state.goals.unshift({
            id: uid(), title, motivation, due, milestones: [], actions: [], createdAt: Date.now()
          });
        }
        save();
        render();
        toast(editing ? '目标已更新' : '目标已添加');
        return null;
      }
    });
  }

  function openPlanDialog(plan) {
    const editing = !!plan;
    const current = plan || { name: '', exercises: [emptyExercise()] };
    const exercises = current.exercises && current.exercises.length ? current.exercises : [emptyExercise()];
    const body =
      '<label class="field"><span>计划名称</span>' +
        '<input name="name" value="' + esc(current.name) + '" maxlength="60" placeholder="如：胸肌训练" required></label>' +
      '<div class="repeat-head"><strong>动作列表</strong>' +
        '<button type="button" class="btn small" data-action="add-exercise">' + icon('plus') + ' 添加动作</button></div>' +
      '<div class="repeater" id="exercise-rows">' + exercises.map(exerciseRowHTML).join('') + '</div>' +
      '<p class="hint">重量 / 次数 / 组数是默认值，记录训练时可以按实际完成情况修改。</p>';

    openDialog({
      title: editing ? '编辑训练计划' : '新建训练计划',
      body,
      wide: true,
      submitLabel: editing ? '保存修改' : '创建计划',
      onSubmit(form) {
        const name = val(form, 'name');
        if (!name) return '请输入计划名称。';
        const nextExercises = collectExercises(form);
        if (!nextExercises.length) return '请至少添加一个动作。';
        const error = validateExercises(nextExercises);
        if (error) return error;
        if (editing) Object.assign(plan, { name, exercises: nextExercises });
        else state.workouts.unshift({
          id: uid(), kind: 'plan', name, exercises: nextExercises, createdAt: Date.now()
        });
        save();
        render();
        toast(editing ? '训练计划已更新' : '训练计划已创建');
        return null;
      }
    });
  }

  function openLogDialog(plan) {
    const exercises = plan && plan.exercises && plan.exercises.length
      ? plan.exercises.map(exercise => Object.assign({}, exercise))
      : [emptyExercise()];
    const body =
      '<div class="field-grid">' +
        '<label class="field"><span>日期</span>' +
          '<input type="date" name="date" value="' + todayStr() + '" required></label>' +
        '<label class="field"><span>计划名</span>' +
          '<input name="planName" value="' + esc(plan ? plan.name : '') + '" maxlength="60" placeholder="如：胸肌训练" required></label>' +
      '</div>' +
      '<div class="repeat-head"><strong>逐动作记录</strong>' +
        '<button type="button" class="btn small" data-action="add-exercise">' + icon('plus') + ' 添加动作</button></div>' +
      '<div class="repeater" id="exercise-rows">' + exercises.map(exerciseRowHTML).join('') + '</div>' +
      '<p class="hint">填写实际完成的重量（kg）、次数和组数；自重动作重量可填 0。</p>';

    openDialog({
      title: '记录训练',
      body,
      wide: true,
      submitLabel: '保存记录',
      onSubmit(form) {
        const date = val(form, 'date');
        if (!parseDay(date)) return '请选择训练日期。';
        const planName = val(form, 'planName');
        if (!planName) return '请填写计划名。';
        const exercises = collectExercises(form);
        if (!exercises.length) return '请至少填写一个动作。';
        const error = validateExercises(exercises);
        if (error) return error;
        state.workouts.push({
          id: uid(), kind: 'log', date, planName, exercises, createdAt: Date.now()
        });
        save();
        render();
        toast('训练记录已保存');
        return null;
      }
    });
  }

  function openActivityDialog(activity) {
    const editing = !!activity;
    const current = activity || {
      title: '', category: '讲座', date: todayStr(), status: '报名', notes: ''
    };
    const body =
      '<label class="field"><span>活动名称</span>' +
        '<input name="title" value="' + esc(current.title) + '" maxlength="80" placeholder="如：人工智能讲座" required></label>' +
      '<div class="field-grid">' +
        '<label class="field"><span>类别</span>' +
          '<input name="category" list="activity-category-list" value="' + esc(current.category) +
          '" maxlength="20" placeholder="讲座 / 比赛 / 社团…">' +
          '<datalist id="activity-category-list">' +
            ACTIVITY_CATEGORIES.map(category => '<option value="' + esc(category) + '"></option>').join('') +
          '</datalist></label>' +
        '<label class="field"><span>日期</span>' +
          '<input type="date" name="date" value="' + esc(current.date) + '" required></label>' +
      '</div>' +
      '<label class="field"><span>状态</span><select name="status">' +
        ACTIVITY_STATUS.map(status => '<option value="' + status + '"' +
          (status === current.status ? ' selected' : '') + '>' + status + '</option>').join('') +
      '</select></label>' +
      '<label class="field"><span>备注（可选）</span>' +
        '<textarea name="notes" maxlength="1000" placeholder="集合地点、注意事项、报名链接等">' +
        esc(current.notes) + '</textarea></label>' +
      '<p class="hint">保存后可以在活动卡片里逐项勾选准备清单。</p>';

    openDialog({
      title: editing ? '编辑活动' : '添加活动',
      body,
      submitLabel: editing ? '保存修改' : '添加活动',
      onSubmit(form) {
        const title = val(form, 'title');
        if (!title) return '请输入活动名称。';
        const category = val(form, 'category') || '其他';
        const date = val(form, 'date');
        if (!parseDay(date)) return '请选择活动日期。';
        const status = val(form, 'status');
        if (!ACTIVITY_STATUS.includes(status)) return '活动状态不正确。';
        const notes = val(form, 'notes');
        if (editing) {
          Object.assign(activity, { title, category, date, status, notes });
        } else {
          state.activities.push({
            id: uid(), title, category, date, status, notes, checklist: []
          });
        }
        save();
        render();
        toast(editing ? '活动已更新' : '活动已添加');
        return null;
      }
    });
  }

  function openBookDialog(book) {
    const editing = !!book;
    const current = book || {
      title: '', author: '', totalPages: 0, pagesRead: 0, status: '想读', notes: ''
    };
    const body =
      '<label class="field"><span>书名</span>' +
        '<input name="title" value="' + esc(current.title) + '" maxlength="80" placeholder="如：人类简史" required></label>' +
      '<label class="field"><span>作者</span>' +
        '<input name="author" value="' + esc(current.author) + '" maxlength="60" placeholder="作者姓名"></label>' +
      '<div class="field-grid">' +
        '<label class="field"><span>总页数</span>' +
          '<input type="number" name="totalPages" min="0" max="99999" step="1" value="' +
          (Number(current.totalPages) || 0) + '"></label>' +
        '<label class="field"><span>已读页数</span>' +
          '<input type="number" name="pagesRead" min="0" max="99999" step="1" value="' +
          (Number(current.pagesRead) || 0) + '"></label>' +
      '</div>' +
      '<label class="field"><span>状态</span><select name="status">' +
        READING_STATUS.map(status => '<option value="' + status + '"' +
          (status === current.status ? ' selected' : '') + '>' + status + '</option>').join('') +
      '</select></label>' +
      '<label class="field"><span>笔记（可选）</span>' +
        '<textarea name="notes" maxlength="1000" placeholder="摘抄、感想或待查资料">' +
        esc(current.notes) + '</textarea></label>';

    openDialog({
      title: editing ? '编辑书籍' : '添加书籍',
      body,
      submitLabel: editing ? '保存修改' : '添加书籍',
      onSubmit(form) {
        const title = val(form, 'title');
        if (!title) return '请输入书名。';
        const author = val(form, 'author');
        const totalPages = Number(val(form, 'totalPages') || 0);
        const pagesReadInput = Number(val(form, 'pagesRead') || 0);
        if (!Number.isInteger(totalPages) || totalPages < 0) return '总页数需为不小于 0 的整数。';
        if (!Number.isInteger(pagesReadInput) || pagesReadInput < 0) return '已读页数需为不小于 0 的整数。';
        if (totalPages > 0 && pagesReadInput > totalPages) return '已读页数不能大于总页数。';
        if (totalPages === 0 && pagesReadInput > 0) return '填写已读页数前，请先填写总页数。';
        let status = val(form, 'status');
        if (!READING_STATUS.includes(status)) status = '想读';
        let pagesRead = pagesReadInput;
        if (totalPages > 0 && status === '已读完') pagesRead = totalPages;
        else if (totalPages > 0 && pagesRead >= totalPages) status = '已读完';
        const notes = val(form, 'notes');
        if (editing) {
          Object.assign(book, { title, author, totalPages, pagesRead, status, notes, updatedAt: Date.now() });
        } else {
          state.books.unshift({
            id: uid(), title, author, totalPages, pagesRead, status, notes, updatedAt: Date.now()
          });
        }
        save();
        render();
        toast(editing ? '书籍已更新' : '书籍已添加');
        return null;
      }
    });
  }

  /* ======================================================================
     十五、删除与快捷操作
     ====================================================================== */

  function deleteCourse(id) {
    const course = findById(state.courses, id);
    if (!course) return;
    if (!confirm('删除课程「' + course.name + '」？此操作不可撤销。')) return;
    commit(() => { state.courses = state.courses.filter(item => item.id !== id); }, '课程已删除');
  }

  function deleteGoal(id) {
    const goal = findById(state.goals, id);
    if (!goal) return;
    if (!confirm('删除目标「' + goal.title + '」及其阶段和行动？此操作不可撤销。')) return;
    commit(() => { state.goals = state.goals.filter(item => item.id !== id); }, '目标已删除');
  }

  function deleteGoalItem(goalId, type, itemId) {
    const goal = findById(state.goals, goalId);
    if (!goal) return;
    const list = type === 'milestone' ? goal.milestones : goal.actions;
    commit(() => {
      const next = list.filter(item => item.id !== itemId);
      if (type === 'milestone') goal.milestones = next;
      else goal.actions = next;
    }, '已删除');
  }

  function deletePlan(id) {
    const plan = findById(state.workouts, id);
    if (!plan) return;
    if (!confirm('删除训练计划「' + plan.name + '」？已有训练记录不会受影响。')) return;
    commit(() => { state.workouts = state.workouts.filter(item => item.id !== id); }, '训练计划已删除');
  }

  function deleteLog(id) {
    const log = findById(state.workouts, id);
    if (!log) return;
    if (!confirm('删除 ' + log.date + ' 的「' + log.planName + '」训练记录？此操作不可撤销。')) return;
    commit(() => { state.workouts = state.workouts.filter(item => item.id !== id); }, '训练记录已删除');
  }

  function deleteActivity(id) {
    const activity = findById(state.activities, id);
    if (!activity) return;
    if (!confirm('删除活动「' + activity.title + '」？此操作不可撤销。')) return;
    commit(() => { state.activities = state.activities.filter(item => item.id !== id); }, '活动已删除');
  }

  function deleteChecklist(activityId, itemId) {
    const activity = findById(state.activities, activityId);
    if (!activity) return;
    commit(() => { activity.checklist = activity.checklist.filter(item => item.id !== itemId); }, '已删除准备项');
  }

  function deleteBook(id) {
    const book = findById(state.books, id);
    if (!book) return;
    if (!confirm('从书架删除「' + book.title + '」？此操作不可撤销。')) return;
    commit(() => { state.books = state.books.filter(item => item.id !== id); }, '书籍已删除');
  }

  function completeActivity(id) {
    const activity = findById(state.activities, id);
    if (!activity) return;
    commit(() => { activity.status = '已结束'; }, '活动已标记为已结束');
  }

  function addTenPages(id) {
    const book = findById(state.books, id);
    if (!book) return;
    const total = Math.max(0, Number(book.totalPages) || 0);
    if (total > 0 && Number(book.pagesRead) >= total) {
      toast('这本书已经读完啦');
      return;
    }
    commit(() => {
      book.pagesRead = (Number(book.pagesRead) || 0) + 10;
      if (total > 0) book.pagesRead = Math.min(total, book.pagesRead);
      if (total > 0 && book.pagesRead >= total) book.status = '已读完';
      book.updatedAt = Date.now();
    });
    toast('已更新为 ' + book.pagesRead + ' 页');
  }

  /* ======================================================================
     十六、导入 / 导出 / 重置
     ====================================================================== */

  function exportData() {
    if (corrupt) {
      alert('当前本机数据无法读取，不能导出。请先导入备份或重置数据。');
      return;
    }
    try {
      const text = JSON.stringify(state, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qingkong-' + todayStr() + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('备份已导出');
    } catch (error) {
      alert('导出失败：' + (error && error.message ? error.message : '未知错误'));
    }
  }

  function isBackupObject(data) {
    return !!data && typeof data === 'object' && !Array.isArray(data) &&
      data.version === VERSION &&
      !!data.settings && typeof data.settings === 'object' &&
      Array.isArray(data.courses) && Array.isArray(data.goals) && Array.isArray(data.workouts) &&
      Array.isArray(data.activities) && Array.isArray(data.books);
  }

  async function handleImportFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        alert('导入失败：文件不是有效的 JSON。');
        return;
      }
      if (!data || data.version !== VERSION) {
        alert('导入失败：备份版本不受支持（需要 version 1）。');
        return;
      }
      if (!isBackupObject(data)) {
        alert('导入失败：备份结构不完整，缺少需要的数据列表。');
        return;
      }
      const counts = '课程 ' + data.courses.length + ' 门、目标 ' + data.goals.length +
        ' 个、训练 ' + data.workouts.length + ' 条、活动 ' + data.activities.length +
        ' 项、书籍 ' + data.books.length + ' 本';
      if (!confirm('确定导入「' + (file.name || '备份文件') + '」吗？\n\n备份包含：' + counts +
        '。\n导入会替换当前浏览器里的全部晴空物语数据，且无法撤销。')) return;
      state = normalizeState(data);
      corrupt = false;
      corruptMessage = '';
      viewWeek = null;
      if (dialogEl.open) dialogEl.close();
      save();
      render();
      toast('备份已导入');
    } catch (error) {
      alert('导入失败：' + (error && error.message ? error.message : '无法读取文件'));
    }
  }

  function resetData() {
    if (!confirm('重置会清空当前浏览器里的全部晴空物语数据（课程、目标、训练、活动、阅读），且无法撤销。\n\n确定重置吗？')) return;
    state = defaultState();
    corrupt = false;
    corruptMessage = '';
    viewWeek = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* 忽略：存储不可用时也继续 */ }
    save();
    render();
    toast('数据已重置');
  }

  /* ======================================================================
     十七、事件绑定
     ====================================================================== */

  function focusCheckbox(kind, attrs) {
    const target = [...document.querySelectorAll('[data-change]')].find(el => {
      if (el.dataset.change !== kind) return false;
      return Object.keys(attrs).every(key => el.dataset[key] === String(attrs[key]));
    });
    if (target) target.focus();
  }

  function focusInlineForm(kind, id) {
    const form = [...document.querySelectorAll('form[data-form]')].find(item =>
      item.dataset.form === kind && item.dataset.id === id
    );
    if (!form) return;
    const input = form.querySelector('input[name="title"]');
    if (input) input.focus();
  }

  function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    switch (action) {
      case 'close-dialog':
        dialogEl.close();
        break;
      case 'export-data':
        exportData();
        break;
      case 'import-data':
        importInput.click();
        break;
      case 'reset-data':
        resetData();
        break;
      case 'open-settings':
        openSettingsDialog();
        break;
      case 'default-periods':
        resetDefaultPeriods();
        break;
      case 'add-exercise':
        addExerciseRow();
        break;
      case 'remove-row': {
        const row = target.closest('.repeat-row');
        if (row) row.remove();
        break;
      }
      case 'new-course':
        openCourseDialog(null);
        break;
      case 'edit-course': {
        const course = findById(state.courses, id);
        if (course) openCourseDialog(course);
        break;
      }
      case 'delete-course':
        deleteCourse(id);
        break;
      case 'prev-week':
        if (viewWeek > 1) { viewWeek -= 1; render(); }
        break;
      case 'next-week':
        if (viewWeek < state.settings.weeks) { viewWeek += 1; render(); }
        break;
      case 'this-week':
        viewWeek = currentWeek() || 1;
        render();
        break;
      case 'new-goal':
        openGoalDialog(null);
        break;
      case 'edit-goal': {
        const goal = findById(state.goals, id);
        if (goal) openGoalDialog(goal);
        break;
      }
      case 'delete-goal':
        deleteGoal(id);
        break;
      case 'delete-goal-item':
        deleteGoalItem(target.dataset.gid, target.dataset.type, id);
        break;
      case 'new-plan':
        openPlanDialog(null);
        break;
      case 'edit-plan': {
        const plan = findById(state.workouts, id);
        if (plan && plan.kind === 'plan') openPlanDialog(plan);
        break;
      }
      case 'delete-plan':
        deletePlan(id);
        break;
      case 'start-log': {
        const plan = findById(state.workouts, id);
        if (plan && plan.kind === 'plan') openLogDialog(plan);
        break;
      }
      case 'new-log':
        openLogDialog(null);
        break;
      case 'delete-log':
        deleteLog(id);
        break;
      case 'new-activity':
        openActivityDialog(null);
        break;
      case 'edit-activity': {
        const activity = findById(state.activities, id);
        if (activity) openActivityDialog(activity);
        break;
      }
      case 'delete-activity':
        deleteActivity(id);
        break;
      case 'complete-activity':
        completeActivity(id);
        break;
      case 'delete-checklist':
        deleteChecklist(id, target.dataset.item);
        break;
      case 'new-book':
        openBookDialog(null);
        break;
      case 'edit-book': {
        const book = findById(state.books, id);
        if (book) openBookDialog(book);
        break;
      }
      case 'delete-book':
        deleteBook(id);
        break;
      case 'read-10':
        addTenPages(id);
        break;
      default:
        break;
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches('[data-change="toggle-goal-item"]')) {
      const goal = findById(state.goals, target.dataset.gid);
      if (!goal) return;
      const list = target.dataset.type === 'milestone' ? goal.milestones : goal.actions;
      const item = findById(list, target.dataset.id);
      if (!item) return;
      item.done = target.checked;
      save();
      render();
      focusCheckbox('toggle-goal-item', {
        gid: target.dataset.gid,
        type: target.dataset.type,
        id: target.dataset.id
      });
      return;
    }
    if (target.matches('[data-change="toggle-checklist"]')) {
      const activity = findById(state.activities, target.dataset.id);
      if (!activity) return;
      const item = findById(activity.checklist, target.dataset.item);
      if (!item) return;
      item.done = target.checked;
      save();
      render();
      focusCheckbox('toggle-checklist', { id: target.dataset.id, item: target.dataset.item });
      return;
    }
    if (target.matches('[name="periodCount"]')) {
      syncPeriodRows(target.value);
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.form;
    const id = form.dataset.id;
    const input = form.querySelector('input[name="title"]');
    const title = input ? input.value.trim() : '';
    if (!title) {
      if (input) input.focus();
      return;
    }
    if (title.length > 80) {
      toast('内容请控制在 80 字以内', 'error');
      return;
    }

    if (kind === 'milestone' || kind === 'action') {
      const goal = findById(state.goals, id);
      if (!goal) return;
      if (kind === 'milestone') goal.milestones.push({ id: uid(), title, done: false });
      else goal.actions.push({ id: uid(), title, done: false });
      save();
      render();
      focusInlineForm(kind, id);
    } else if (kind === 'checklist') {
      const activity = findById(state.activities, id);
      if (!activity) return;
      activity.checklist.push({ id: uid(), title, done: false });
      save();
      render();
      focusInlineForm('checklist', id);
    }
  }

  function bindEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('submit', handleSubmit);

    dialogBodyEl.addEventListener('submit', event => {
      const form = event.target.closest('form');
      if (!form || form.id !== 'dialog-form' || !dialogSubmit) return;
      event.preventDefault();
      const error = document.getElementById('form-error');
      if (error) error.hidden = true;
      let message = null;
      try {
        message = dialogSubmit(form);
      } catch (err) {
        message = '保存失败：' + (err && err.message ? err.message : '未知错误');
      }
      if (message) {
        showFormError(message);
        return;
      }
      dialogEl.close();
    });

    dialogEl.addEventListener('close', () => {
      dialogSubmit = null;
      dialogBodyEl.innerHTML = '';
      dialogEl.classList.remove('wide');
    });

    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      handleImportFile(file);
    });

    window.addEventListener('hashchange', () => {
      activeTab = routeFromHash();
      render();
      window.scrollTo(0, 0);
    });

    // 同一个浏览器里开两个页面时，让数据保持一致
    window.addEventListener('storage', event => {
      if (event.key !== STORAGE_KEY) return;
      const loaded = loadState();
      state = loaded.state;
      corrupt = !!loaded.error;
      corruptMessage = loaded.error;
      render();
      if (!corrupt) toast('已同步另一个页面的修改');
    });
  }

  /* ======================================================================
     十八、启动
     ====================================================================== */

  function routeFromHash() {
    let hash = '';
    try {
      hash = decodeURIComponent(location.hash.replace(/^#/, '')).toLowerCase();
    } catch (error) {
      hash = '';
    }
    return ROUTE_ALIASES[hash] || 'overview';
  }

  function init() {
    const loaded = loadState();
    state = loaded.state;
    corrupt = !!loaded.error;
    corruptMessage = loaded.error;
    activeTab = routeFromHash();
    bindEvents();
    render();
  }

  init();
})();