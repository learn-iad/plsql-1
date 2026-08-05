/* eslint-disable no-unused-vars */
var SqlUtil = (function () {
  function stripComments(sql) {
    return sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ');
  }

  function normalize(sql) {
    return stripComments(sql).replace(/\s+/g, ' ').trim();
  }

  function splitStatements(sql) {
    var out = [];
    var cur = '';
    var inStr = false;
    var strCh = '';
    for (var i = 0; i < sql.length; i++) {
      var ch = sql[i];
      var next = sql[i + 1];
      if (!inStr && ch === '-' && next === '-') {
        while (i < sql.length && sql[i] !== '\n') i++;
        cur += ' ';
        continue;
      }
      if (!inStr && ch === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i++;
        cur += ' ';
        continue;
      }
      if ((ch === "'" || ch === '"') && (!inStr || strCh === ch)) {
        if (!inStr) { inStr = true; strCh = ch; }
        else if (sql[i + 1] === ch) { cur += ch + ch; i++; continue; }
        else { inStr = false; strCh = ''; }
      }
      if (!inStr && ch === ';') {
        var t = cur.trim();
        if (t) out.push(t);
        cur = '';
        continue;
      }
      cur += ch;
    }
    var last = cur.trim();
    if (last) out.push(last);
    return out;
  }

  function hasComments(sql) {
    return /\/\*[\s\S]*?\*\//.test(sql) || /--[^\n]*/.test(sql);
  }

  function detectSchema(sql) {
    var m = sql.match(/\b(\w+)\.(?:Agent|AGENTS|agents)\b/i);
    return m ? m[1].toLowerCase() : null;
  }

  function stmtMatch(stmt, re) {
    return re.test(normalize(stmt));
  }

  function allStmts(sql, pred) {
    return splitStatements(sql).filter(pred);
  }

  function countMatches(sql, re) {
    var n = 0;
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(stripComments(sql))) !== null) n++;
    return n;
  }

  return {
    stripComments: stripComments,
    normalize: normalize,
    splitStatements: splitStatements,
    hasComments: hasComments,
    detectSchema: detectSchema,
    stmtMatch: stmtMatch,
    allStmts: allStmts,
    countMatches: countMatches
  };
})();
