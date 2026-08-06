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
    return splitStatementsDetailed(sql).map(function (s) { return s.text; });
  }

  /** Разбивка: «;» или «/» на отдельной строке (без символов до «/» в строке). */
  function splitStatementsDetailed(sql) {
    var out = [];
    var cur = '';
    var curStart = 0;
    var pos = 0;
    var inStr = false;
    var strCh = '';
    var lineStart = 0;

    function flush(endPos) {
      var t = cur.trim();
      if (t) out.push({ text: t, start: curStart, end: endPos });
      cur = '';
      curStart = endPos;
    }

    function atLineStart(i) {
      var chunk = sql.slice(lineStart, i);
      return chunk.length === 0 || /^\s*$/.test(chunk);
    }

    for (var i = 0; i < sql.length; i++) {
      var ch = sql[i];
      var next = sql[i + 1];

      if (ch === '\n') {
        lineStart = i + 1;
      }

      if (!inStr && ch === '-' && next === '-') {
        while (i < sql.length && sql[i] !== '\n') i++;
        cur += ' ';
        pos = i + 1;
        continue;
      }
      if (!inStr && ch === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i++;
        cur += ' ';
        pos = i + 1;
        continue;
      }
      if (!inStr && ch === '/' && atLineStart(i) && next !== '*') {
        flush(i);
        while (i < sql.length && sql[i] !== '\n') i++;
        lineStart = i + 1;
        pos = i + 1;
        continue;
      }
      if ((ch === "'" || ch === '"') && (!inStr || strCh === ch)) {
        if (!inStr) { inStr = true; strCh = ch; }
        else if (sql[i + 1] === ch) { cur += ch + ch; i++; pos = i + 1; continue; }
        else { inStr = false; strCh = ''; }
      }
      if (!inStr && ch === ';') {
        flush(i);
        pos = i + 1;
        curStart = pos;
        continue;
      }
      if (!cur) curStart = pos;
      cur += ch;
      pos = i + 1;
    }
    flush(sql.length);
    return out;
  }

  var TYPO_PATTERNS = [
    [/\bCREAT\s+TABLE\b/i, 'CREAT → CREATE'],
    [/\bCRATE\s+TABLE\b/i, 'CRATE → CREATE'],
    [/\bUDPATE\b/i, 'UDPATE → UPDATE'],
    [/\bUDPATE\s+TABLE\b/i, 'UDPATE → UPDATE'],
    [/\bINSER\s+INTO\b/i, 'INSER → INSERT'],
    [/\bINSRET\s+INTO\b/i, 'INSRET → INSERT'],
    [/\bSELCT\b/i, 'SELCT → SELECT'],
    [/\bSLECT\b/i, 'SLECT → SELECT'],
    [/\bALTR\s+TABLE\b/i, 'ALTR → ALTER'],
    [/\bALTRE\s+TABLE\b/i, 'ALTRE → ALTER'],
    [/\bDRO\s+TABLE\b/i, 'DRO → DROP'],
    [/\bDELTE\s+FROM\b/i, 'DELTE → DELETE'],
    [/\bVARCHA2\b/i, 'VARCHA2 → VARCHAR2'],
    [/\bVARCHAR\b(?!2)/i, 'VARCHAR → VARCHAR2 (для Oracle)'],
    [/\bNUBMER\b/i, 'NUBMER → NUMBER'],
    [/\bNUMBR\b/i, 'NUMBR → NUMBER']
  ];

  var SQL_START = /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|COMMIT|TRUNCATE|GRANT|REVOKE|SET|BEGIN|DECLARE|EXEC|EXECUTE)\b/i;

  function validateStatement(stmt) {
    var issues = [];
    var norm = normalize(stmt);
    if (!norm) return { valid: true, issues: [] };

    TYPO_PATTERNS.forEach(function (pair) {
      if (pair[0].test(norm)) issues.push('Опечатка: ' + pair[1]);
    });

    if (!SQL_START.test(norm)) {
      issues.push('Не распознана команда SQL/PL-SQL');
    }

    if (/\(\s*,|\,\s*\)/.test(norm)) {
      issues.push('Лишняя или пропущенная запятая в списке');
    }

    return { valid: issues.length === 0, issues: issues };
  }

  function validateCode(sql) {
    var stmts = splitStatementsDetailed(sql);
    var invalidLines = {};
    var problems = [];

    stmts.forEach(function (s, idx) {
      var v = validateStatement(s.text);
      if (v.valid) return;
      var before = sql.slice(0, s.start);
      var startLine = before.split('\n').length;
      var endLine = sql.slice(0, s.end).split('\n').length;
      for (var ln = startLine; ln <= endLine; ln++) invalidLines[ln] = true;
      problems.push({ index: idx + 1, lines: [startLine, endLine], issues: v.issues });
    });

    return { invalidLines: invalidLines, problems: problems };
  }

  function posToLine(sql, pos) {
    return sql.slice(0, pos).split('\n').length;
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

  var SQL_KW = 'CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|FROM|WHERE|SET|TABLE|AS|INTO|ADD|MODIFY|DEFAULT|COMMIT|NUMBER|VARCHAR2|DATE|ORDER|BY|FETCH|FIRST|ROWS|ONLY|JOIN|ON|AND|OR|NOT|NULL|IS|IN|VALUES|NEXTVAL|TO_DATE|TRUNCATE|GRANT|REVOKE|BEGIN|DECLARE|EXEC|EXECUTE|PRIMARY|KEY|CONSTRAINT|INDEX|VIEW|SEQUENCE|UNION|ALL|DISTINCT|GROUP|HAVING|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END';

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightLine(line) {
    var parts = [];
    var i = 0;
    var reKw = new RegExp('\\b(' + SQL_KW + ')\\b', 'gi');

    function pushPlain(text) {
      if (!text) return;
      var last = 0;
      var m;
      reKw.lastIndex = 0;
      while ((m = reKw.exec(text)) !== null) {
        if (m.index > last) parts.push(escHtml(text.slice(last, m.index)));
        parts.push('<span class="hl-kw">' + escHtml(m[0]) + '</span>');
        last = m.index + m[0].length;
      }
      if (last < text.length) parts.push(escHtml(text.slice(last)));
    }

    while (i < line.length) {
      var rest = line.slice(i);
      if (rest.match(/^--/)) {
        parts.push('<span class="hl-cmt">' + escHtml(rest) + '</span>');
        break;
      }
      if (rest[0] === "'") {
        var j = 1;
        while (j < rest.length) {
          if (rest[j] === "'" && rest[j + 1] === "'") { j += 2; continue; }
          if (rest[j] === "'") break;
          j++;
        }
        parts.push('<span class="hl-str">' + escHtml(rest.slice(0, j + 1)) + '</span>');
        i += j + 1;
        continue;
      }
      if (rest[0] === '"') {
        var k = rest.indexOf('"', 1);
        if (k === -1) k = rest.length - 1;
        parts.push('<span class="hl-str">' + escHtml(rest.slice(0, k + 1)) + '</span>');
        i += k + 1;
        continue;
      }
      var num = rest.match(/^(\d+(?:\.\d+)?)/);
      if (num && (i === 0 || !/[A-Za-z_]$/.test(line.slice(0, i)))) {
        parts.push('<span class="hl-num">' + escHtml(num[1]) + '</span>');
        i += num[1].length;
        continue;
      }
      var next = rest.search(/(?:--|'|"|\d)/);
      if (next === -1) { pushPlain(rest); break; }
      if (next > 0) { pushPlain(rest.slice(0, next)); i += next; continue; }
      parts.push(escHtml(rest[0]));
      i++;
    }
    return parts.join('') || ' ';
  }

  function highlightSql(code) {
    return code.split('\n').map(function (ln) { return highlightLine(ln); });
  }

  return {
    stripComments: stripComments,
    normalize: normalize,
    splitStatements: splitStatements,
    splitStatementsDetailed: splitStatementsDetailed,
    validateStatement: validateStatement,
    validateCode: validateCode,
    posToLine: posToLine,
    hasComments: hasComments,
    detectSchema: detectSchema,
    stmtMatch: stmtMatch,
    allStmts: allStmts,
    countMatches: countMatches,
    highlightSql: highlightSql
  };
})();
