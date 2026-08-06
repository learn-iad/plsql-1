/* eslint-disable no-unused-vars */
var History = (function () {
  var KEY = 'plsql_trainer_v1';
  var DRAFT_KEY = 'plsql_trainer_v1_draft';
  var MAX_ATTEMPTS = 100;

  var CRITERION_CATEGORIES = {
    comments: 'comment',
    select_fork_comment: 'comment',
    rollback_comment: 'comment',
    distinct_comment: 'comment',
    delete_fork_comment: 'comment',
    gaps_comment: 'comment',
    schema_create_agent: 'schema',
    schema_second_update: 'schema',
    schema_create: 'schema',
    schema_update: 'schema',
    aliases: 'alias',
    drop_not_delete: 'wrong_command',
    drop_purge: 'wrong_command',
    truncate: 'wrong_command',
    create_agent: 'structure',
    alter_birth: 'structure',
    ctas_agents: 'structure',
    defaults: 'structure',
    ctas_partners: 'structure',
    alter_agent: 'structure',
    create_partnersCopy: 'structure',
    modify_text: 'structure',
    create_insuranceTypes: 'structure',
    ctas_partners_full: 'structure',
    add_emergency_col: 'structure',
    insert_agent: 'data',
    supervisor_alter: 'data',
    insert_partner: 'data',
    insert_all_5: 'data',
    insert_products: 'data',
    insert_all_agents: 'data',
    update_phone_mail: 'data',
    delete_all: 'data',
    supervisor_update_all: 'query_logic',
    supervisor_update_cond: 'query_logic',
    final_select: 'query_logic',
    select_10pct: 'query_logic',
    update_agency: 'query_logic',
    create_and_deletes: 'query_logic',
    delete_agents_match: 'query_logic',
    update_partner_gaps: 'query_logic'
  };

  var CATEGORY_LABELS = {
    comment: 'Комментарии и пояснения',
    schema: 'Схема перед таблицами',
    alias: 'Алиасы таблиц',
    wrong_command: 'Выбор DROP вместо DELETE',
    structure: 'Структура таблиц (CREATE/ALTER)',
    data: 'INSERT и изменение данных',
    query_logic: 'Логика запросов (UPDATE/SELECT)'
  };

  /** Ачивки за уверенные навыки; отзываются при ошибке в той же категории */
  var ACHIEVEMENTS = {
    comment: {
      id: 'comment',
      emoji: '💬',
      rarity: 'common',
      title: 'Голос за кадром',
      desc: 'Оставляете комментарии и поясняете развилки — будущий вы скажет спасибо.'
    },
    schema: {
      id: 'schema',
      emoji: '🏛️',
      rarity: 'rare',
      title: 'Схемопат',
      desc: 'Пишете schema.table там, где Oracle иначе скажет «не знаю такую таблицу».'
    },
    alias: {
      id: 'alias',
      emoji: '🏷️',
      rarity: 'common',
      title: 'Мастер псевдонимов',
      desc: 'UPDATE/SELECT с алиасами (ag.) — код читается, столбцы не путаются.'
    },
    wrong_command: {
      id: 'wrong_command',
      emoji: '⚡',
      rarity: 'rare',
      title: 'Не путать с DELETE',
      desc: 'Таблицу убираете через DROP, а не через DELETE FROM — объекты и строки не смешиваете.'
    },
    structure: {
      id: 'structure',
      emoji: '🏗️',
      rarity: 'rare',
      title: 'Архитектор таблиц',
      desc: 'CREATE/ALTER/CTAS и defaults — каркас базы собираете уверенно.'
    },
    data: {
      id: 'data',
      emoji: '📥',
      rarity: 'common',
      title: 'Данный человек',
      desc: 'INSERT и правки данных попадают в цель: sequence, рейтинги, даты.'
    },
    query_logic: {
      id: 'query_logic',
      emoji: '👑',
      rarity: 'legendary',
      title: 'Логик с FETCH',
      desc: 'UPDATE/SELECT с условиями, сортировкой и TOP — запросы делают то, что задумано.'
    },
    analyst_path: {
      id: 'analyst_path',
      emoji: '🧭',
      rarity: 'common',
      title: 'Путь аналитика',
      desc: 'Ты приступил к практическому тренажёру.'
    },
    streak_2: {
      id: 'streak_2',
      emoji: '⚡',
      rarity: 'rare',
      title: '×2 к мощности',
      desc: 'Сдал 2 задания подряд — серия началась!'
    },
    streak_3: {
      id: 'streak_3',
      emoji: '🧠',
      rarity: 'rare',
      title: '×3 к интеллекту',
      desc: 'Три задания подряд — мыслишь всё увереннее.'
    },
    streak_4: {
      id: 'streak_4',
      emoji: '🔥',
      rarity: 'legendary',
      title: '×4 к точности',
      desc: 'Четыре задания подряд — почти безупречная серия.'
    },
    streak_5: {
      id: 'streak_5',
      emoji: '🚀',
      rarity: 'legendary',
      title: '×5 к мастерству',
      desc: 'Все задания подряд — полный зачёт по курсу!'
    }
  };

  var STREAK_ACH_IDS = ['streak_2', 'streak_3', 'streak_4', 'streak_5'];

  function ensureMeta(data) {
    if (!data.meta) data.meta = {};
    return data;
  }

  function markTrainerStarted() {
    var data = load();
    ensureMeta(data);
    if (data.meta.started) return false;
    var grantAnalyst = data.attempts.length === 0;
    data.meta.started = true;
    data.meta.startedAt = Date.now();
    if (grantAnalyst) data.meta.analystPath = true;
    save(data);
    return grantAnalyst;
  }

  function computeTaskStreak(tasks) {
    var data = load();
    var passed = {};
    data.attempts.forEach(function (a) {
      if (a.pass) passed[a.taskId] = true;
    });
    var streak = 0;
    for (var i = 0; i < tasks.length; i++) {
      if (passed[tasks[i].id]) streak++;
      else break;
    }
    return streak;
  }

  function getSpecialAchievementIds(tasks) {
    var data = load();
    ensureMeta(data);
    var ids = [];
    if (data.meta.analystPath) ids.push('analyst_path');
    var streak = computeTaskStreak(tasks);
    STREAK_ACH_IDS.forEach(function (id, i) {
      if (streak >= i + 2) ids.push(id);
    });
    return ids;
  }

  function getAchievement(id) {
    return ACHIEVEMENTS[id] || null;
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"attempts":[],"meta":{}}');
    } catch (e) {
      return { attempts: [], meta: {} };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function categorizeCriterion(id) {
    return CRITERION_CATEGORIES[id] || 'other';
  }

  function loadDrafts() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function compressOracleErrors(errors) {
    return (errors || [])
      .filter(function (e) { return e.code !== 'INFO'; })
      .map(function (e) { return { code: e.code, title: e.title }; });
  }

  function addAttempt(taskId, result, codeSnippet) {
    var data = load();
    var code = codeSnippet || '';
    data.attempts.push({
      ts: Date.now(),
      taskId: taskId,
      score: result.score,
      pass: result.pass,
      criteria: result.criteria.map(function (c) {
        return {
          id: c.id,
          label: c.label,
          pass: c.pass,
          category: categorizeCriterion(c.id),
          detail: c.detail || null
        };
      }),
      code: code,
      codeLen: code.length,
      oracleErrors: compressOracleErrors(result.oracleErrors)
    });
    if (data.attempts.length > MAX_ATTEMPTS) {
      data.attempts = data.attempts.slice(-MAX_ATTEMPTS);
    }
    save(data);
    return data;
  }

  function hasAnyPass() {
    return load().attempts.some(function (a) { return a.pass; });
  }

  function report(tasks) {
    var data = load();
    var byCategory = {};
    var firstPassGood = {};
    var taskPasses = {};
    var earned = {};

    Object.keys(CATEGORY_LABELS).forEach(function (k) {
      byCategory[k] = { fail: 0, pass: 0 };
      earned[k] = false;
    });

    data.attempts.forEach(function (a) {
      if (a.pass) taskPasses[a.taskId] = true;

      var isFirstOnTask = !data.attempts.some(function (x) {
        return x.taskId === a.taskId && x.ts < a.ts;
      });

      var catPass = {};
      var catFail = {};

      (a.criteria || []).forEach(function (c) {
        var cat = c.category || categorizeCriterion(c.id);
        if (!byCategory[cat]) byCategory[cat] = { fail: 0, pass: 0 };
        if (c.pass) {
          byCategory[cat].pass++;
          catPass[cat] = true;
          if (isFirstOnTask) firstPassGood[cat] = (firstPassGood[cat] || 0) + 1;
        } else {
          byCategory[cat].fail++;
          catFail[cat] = true;
        }
      });

      Object.keys(catFail).forEach(function (cat) { earned[cat] = false; });
      Object.keys(catPass).forEach(function (cat) {
        if (!catFail[cat]) earned[cat] = true;
      });
    });

    var achievements = [];
    var growthAreas = [];

    getSpecialAchievementIds(tasks).forEach(function (id) {
      if (ACHIEVEMENTS[id]) achievements.push(ACHIEVEMENTS[id]);
    });

    Object.keys(byCategory).forEach(function (cat) {
      var s = byCategory[cat];
      if (!CATEGORY_LABELS[cat]) return;
      if (earned[cat] && ACHIEVEMENTS[cat]) {
        achievements.push(ACHIEVEMENTS[cat]);
      }
      if (s.fail > 0) {
        growthAreas.push({
          cat: cat,
          label: CATEGORY_LABELS[cat],
          fails: s.fail,
          passes: s.pass
        });
      }
    });

    growthAreas.sort(function (a, b) { return b.fails - a.fails; });

    var firstTryStrengths = Object.keys(firstPassGood)
      .filter(function (cat) { return CATEGORY_LABELS[cat]; })
      .map(function (cat) { return CATEGORY_LABELS[cat]; });

    return {
      attempts: data.attempts.length,
      hasPass: hasAnyPass(),
      taskPasses: taskPasses,
      achievements: achievements,
      growthAreas: growthAreas,
      firstTryStrengths: firstTryStrengths
    };
  }

  function buildExportPayload(meta, tasks) {
    var data = load();
    var summary = report(tasks);
    var taskById = {};
    tasks.forEach(function (t) { taskById[t.id] = t; });

    var taskScores = {};
    var taskPassed = {};
    tasks.forEach(function (t) {
      taskScores[t.id] = null;
      taskPassed[t.id] = false;
    });

    data.attempts.forEach(function (a) {
      if (taskScores[a.taskId] == null || a.score > taskScores[a.taskId]) {
        taskScores[a.taskId] = a.score;
      }
      if (a.pass) taskPassed[a.taskId] = true;
    });

    var tasksDone = Object.keys(taskPassed).filter(function (k) { return taskPassed[k]; }).length;

    var attempts = data.attempts.map(function (a, i) {
      var task = taskById[a.taskId] || {};
      return {
        sessionId: meta.sessionId,
        student: meta.student,
        group: meta.group,
        attemptNo: i + 1,
        taskId: a.taskId,
        taskTitle: task.title || a.taskId,
        ts: a.ts,
        score: a.score,
        pass: a.pass,
        codeLen: a.codeLen || (a.code ? a.code.length : 0),
        code: a.code || '',
        criteria: a.criteria || [],
        oracleErrors: a.oracleErrors || [],
        secFromStart: meta.startedAt ? Math.round((a.ts - meta.startedAt) / 1000) : null
      };
    });

    return {
      session: {
        sessionId: meta.sessionId,
        course: meta.courseName || 'PL/SQL Oracle Trainer',
        student: meta.student,
        group: meta.group,
        status: meta.completed ? 'Завершён' : 'В процессе',
        startedAt: meta.startedAt,
        finishedAt: meta.finishedAt || null,
        completed: !!meta.completed,
        tasksDone: tasksDone,
        tasksTotal: tasks.length,
        totalAttempts: data.attempts.length,
        taskScores: taskScores,
        taskPassed: taskPassed,
        achievements: summary.achievements,
        growthAreas: summary.growthAreas,
        firstTryStrengths: summary.firstTryStrengths,
        drafts: loadDrafts(),
        trainerVersion: 'v1'
      },
      attempts: attempts
    };
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return {
    load: load,
    addAttempt: addAttempt,
    report: report,
    buildExportPayload: buildExportPayload,
    hasAnyPass: hasAnyPass,
    clear: clear,
    markTrainerStarted: markTrainerStarted,
    computeTaskStreak: computeTaskStreak,
    getAchievement: getAchievement,
    CATEGORY_LABELS: CATEGORY_LABELS,
    ACHIEVEMENTS: ACHIEVEMENTS
  };
})();
