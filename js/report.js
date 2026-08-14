/* eslint-disable no-unused-vars */
var Report = (function () {
  var REPORT_CONFIG = {
    endpoint: 'https://script.google.com/macros/s/AKfycbxe-5OE5cbTibjAjwf-qE-SCtuPImnPeDNMugNSGNdgU5iaVdrggloLhNJxdSmOGLyUPw/exec',
    courseName: 'PL/SQL Oracle Trainer',
    autoSendOnComplete: true,
    sendOnLeave: true
  };

  var telemetry = {
    sessionId: '',
    student: '',
    group: '',
    startedAt: null,
    finishedAt: null,
    completed: false,
    completeSent: false,
    leaveSent: false
  };

  function nowMs() { return Date.now(); }

  function fmtDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m > 0 ? m + ' мин ' : '') + s + ' сек';
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function isConfigured() {
    return REPORT_CONFIG.endpoint && REPORT_CONFIG.endpoint.indexOf('PASTE_YOUR') !== 0;
  }

  function initSession(student, group) {
    telemetry.sessionId = generateSessionId();
    telemetry.student = student;
    telemetry.group = group;
    telemetry.startedAt = nowMs();
    telemetry.finishedAt = null;
    telemetry.completed = false;
    telemetry.completeSent = false;
    telemetry.leaveSent = false;
  }

  function markCompleted() {
    telemetry.completed = true;
    telemetry.finishedAt = nowMs();
  }

  function truncateCode(code, maxLen) {
    maxLen = maxLen || 12000;
    if (!code || code.length <= maxLen) return code;
    return code.slice(0, maxLen) + '\n\n[truncated, total ' + code.length + ' chars]';
  }

  function buildReportPayload(tasks, reason) {
    var exportData = History.buildExportPayload({
      sessionId: telemetry.sessionId,
      student: telemetry.student,
      group: telemetry.group,
      startedAt: telemetry.startedAt,
      finishedAt: telemetry.finishedAt,
      completed: telemetry.completed,
      courseName: REPORT_CONFIG.courseName
    }, tasks);

    var totalMs = (telemetry.finishedAt || nowMs()) - (telemetry.startedAt || nowMs());
    var session = exportData.session;

    return {
      reason: reason || 'manual',
      sessionId: session.sessionId,
      submittedAt: fmtTime(nowMs()),
      course: session.course,
      student: session.student,
      group: session.group,
      status: session.status,
      startedAt: fmtTime(session.startedAt),
      finishedAt: session.finishedAt ? fmtTime(session.finishedAt) : '',
      totalDuration: fmtDuration(totalMs),
      tasksDone: session.tasksDone,
      tasksTotal: session.tasksTotal,
      totalAttempts: session.totalAttempts,
      taskScores: JSON.stringify(session.taskScores),
      taskPassed: JSON.stringify(session.taskPassed),
      taskForced: JSON.stringify(session.taskForced || {}),
      achievements: JSON.stringify(session.achievements),
      growthAreas: JSON.stringify(session.growthAreas),
      firstTryStrengths: JSON.stringify(session.firstTryStrengths),
      drafts: JSON.stringify(session.drafts),
      trainerVersion: session.trainerVersion,
      attemptsJson: JSON.stringify(exportData.attempts.map(function (a) {
        return {
          sessionId: a.sessionId,
          student: a.student,
          group: a.group,
          attemptNo: a.attemptNo,
          taskId: a.taskId,
          taskTitle: a.taskTitle,
          ts: fmtTime(a.ts),
          score: a.score,
          pass: a.pass,
          forced: !!a.forced,
          codeLen: a.codeLen,
          code: truncateCode(a.code),
          criteria: a.criteria,
          oracleErrors: a.oracleErrors,
          secFromStart: a.secFromStart
        };
      }))
    };
  }

  function sendReport(reason, tasks, onDone) {
    reason = reason || 'complete';
    if (reason !== 'manual') {
      if (telemetry.completeSent) { if (onDone) onDone(true); return; }
      if (reason === 'leave' && (telemetry.completed || telemetry.leaveSent)) {
        if (onDone) onDone(true);
        return;
      }
    }
    if (!isConfigured()) { if (onDone) onDone(false); return; }
    if (!telemetry.startedAt) { if (onDone) onDone(false); return; }

    var payload = buildReportPayload(tasks, reason);
    try {
      var body = new URLSearchParams();
      Object.keys(payload).forEach(function (k) { body.append(k, payload[k]); });
      if (reason === 'leave' && navigator.sendBeacon) {
        navigator.sendBeacon(
          REPORT_CONFIG.endpoint,
          new Blob([body.toString()], { type: 'application/x-www-form-urlencoded' })
        );
        telemetry.leaveSent = true;
        if (onDone) onDone(true);
        return;
      }
      fetch(REPORT_CONFIG.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
        .then(function () {
          if (reason === 'complete') telemetry.completeSent = true;
          if (reason === 'leave') telemetry.leaveSent = true;
          if (onDone) onDone(true);
        })
        .catch(function () { if (onDone) onDone(false); });
    } catch (e) {
      if (onDone) onDone(false);
    }
  }

  function downloadReport(tasks) {
    var payload = buildReportPayload(tasks, 'download');
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var name = (payload.student + '_' + payload.group).replace(/[^\wа-яёА-ЯЁ-]+/g, '_') || 'отчёт';
    a.href = url;
    a.download = 'plsql_отчёт_' + name + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  return {
    CONFIG: REPORT_CONFIG,
    initSession: initSession,
    markCompleted: markCompleted,
    buildReportPayload: buildReportPayload,
    sendReport: sendReport,
    downloadReport: downloadReport,
    isConfigured: isConfigured,
    getTelemetry: function () { return telemetry; }
  };
})();
