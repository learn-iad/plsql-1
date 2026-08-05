/* eslint-disable no-unused-vars */
var History = (function () {
  var KEY = 'plsql_trainer_v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"attempts":[]}');
    } catch (e) {
      return { attempts: [] };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function addAttempt(taskId, result, codeSnippet) {
    var data = load();
    data.attempts.push({
      ts: Date.now(),
      taskId: taskId,
      score: result.score,
      pass: result.pass,
      criteria: result.criteria.map(function (c) {
        return { id: c.id, pass: c.pass };
      }),
      codeLen: (codeSnippet || '').length
    });
    save(data);
    return data;
  }

  function report(tasks) {
    var data = load();
    var byCriterion = {};
    var byTask = {};

    data.attempts.forEach(function (a) {
      if (!byTask[a.taskId]) byTask[a.taskId] = { tries: 0, best: 0, last: 0 };
      byTask[a.taskId].tries++;
      byTask[a.taskId].best = Math.max(byTask[a.taskId].best, a.score);
      byTask[a.taskId].last = a.score;
      (a.criteria || []).forEach(function (c) {
        if (!byCriterion[c.id]) byCriterion[c.id] = { pass: 0, fail: 0 };
        if (c.pass) byCriterion[c.id].pass++;
        else byCriterion[c.id].fail++;
      });
    });

    var strengths = [];
    var weaknesses = [];
    Object.keys(byCriterion).forEach(function (id) {
      var s = byCriterion[id];
      var task = tasks.find(function (t) {
        return t.rubric.some(function (r) { return r.id === id; });
      });
      var label = id;
      if (task) {
        var rub = task.rubric.find(function (r) { return r.id === id; });
        if (rub) label = rub.label;
      }
      if (s.pass >= s.fail && s.pass > 0) strengths.push(label);
      if (s.fail > s.pass) weaknesses.push(label);
    });

    return {
      attempts: data.attempts.length,
      byTask: byTask,
      strengths: strengths,
      weaknesses: weaknesses
    };
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { load: load, addAttempt: addAttempt, report: report, clear: clear };
})();
