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
    [/\bNUBMER\b/i, 'NUBMER → NUMBER'],
    [/\bNUMBR\b/i, 'NUMBR → NUMBER']
  ];

  var SQL_START = /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|COMMIT|TRUNCATE|GRANT|REVOKE|SET|BEGIN|DECLARE|EXEC|EXECUTE|MERGE)\b/i;

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
    var trimmed = sql.trim();
    var endsComplete = /;\s*$/.test(trimmed) || /\/\s*$/.test(trimmed);
    var toValidate = endsComplete ? stmts : stmts.slice(0, -1);
    var invalidLines = {};
    var problems = [];

    toValidate.forEach(function (s, idx) {
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

  function isCommentLine(line) {
    var t = line.trim();
    return !t || /^--/.test(t) || /^\/\*/.test(t) || /^\*\//.test(t) || /^\*/.test(t);
  }

  function blockHasSql(text) {
    var norm = normalize(text);
    return norm.length > 0 && SQL_START.test(norm);
  }

  function splitCodeBlocks(code) {
    var blocks = [];
    var cur = [];
    code.split('\n').forEach(function (line) {
      if (line.trim() === '' && cur.length) {
        blocks.push(cur.join('\n'));
        cur = [];
      } else {
        cur.push(line);
      }
    });
    if (cur.length) blocks.push(cur.join('\n'));
    return blocks.filter(function (b) { return b.trim(); });
  }

  function blockIsCommentOnly(block) {
    return block.split('\n').every(isCommentLine);
  }

  function blockHasOwnComment(block) {
    if (/\/\*[\s\S]*?\*\//.test(block)) return true;
    var lines = block.split('\n').filter(function (l) { return l.trim(); });
    var first = lines[0];
    if (first && /^--/.test(first.trim())) return true;
    return lines.some(function (l) {
      var t = l.trim();
      return t && !/^--/.test(t) && /--\s+\S/.test(l);
    });
  }

  function countDefaultFields(norm, fields) {
    return fields.filter(function (f) {
      return new RegExp('MODIFY[\\s\\S]{0,900}\\b' + f + '\\b[\\s\\S]{0,80}\\bDEFAULT\\b', 'i').test(norm) ||
        new RegExp('\\bALTER\\s+TABLE\\s+[\\w.]+\\s+MODIFY\\s+' + f + '\\s+DEFAULT\\b', 'i').test(norm);
    });
  }

  function hasInsertBeginDateSep2025(code, norm) {
    if (/\bto_date\s*\(\s*'01[\.\/-]09[\.\/-]2025'/i.test(code)) return true;
    if (/\bdate\s+'2025-09-01'/i.test(norm)) return true;
    if (/\b01-SEP-2025\b/i.test(code)) return true;
    if (/\bbegin_date\b/i.test(norm) && /\b01[\.\/-]09[\.\/-]2025\b/i.test(code)) return true;
    return false;
  }

  var RE_UPDATE_SET = /\bUPDATE\s+[\w.]+\s+(?:\w+\s+)?SET\b/i;
  var RE_UPDATE_SCHEMA = /\bUPDATE\s+\w+\.\w+\s+(?:\w+\s+)?SET\b/i;

  function hasAnyUpdateAlias(norm) {
    var re = /\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./gi;
    return re.test(norm);
  }

  function hasAnyDeleteAlias(norm) {
    var re = /\bDELETE\s+FROM\s+[\w.]+\s+(\w+)\b/gi;
    var m;
    while ((m = re.exec(norm))) {
      if (!isSqlAliasWord(m[1])) continue;
      if (new RegExp('\\b' + m[1] + '\\.').test(norm)) return true;
    }
    return false;
  }

  function isSqlAliasWord(word) {
    return word && !/^(WHERE|ORDER|GROUP|HAVING|UNION|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ON|AND|OR|SET|VALUES|SELECT|BY|ASC|DESC|FETCH|OFFSET|START|CONNECT|PIVOT|UNPIVOT)$/i.test(word);
  }

  function hasAnySelectAlias(norm) {
    var re = /\bFROM\s+[\w.]+\s+(\w+)\b/gi;
    var m;
    while ((m = re.exec(norm))) {
      if (!isSqlAliasWord(m[1])) continue;
      if (new RegExp('\\b' + m[1] + '\\.').test(norm)) return true;
    }
    re = /\bFROM\s*\([\s\S]*?\)\s+(\w+)\b/gi;
    while ((m = re.exec(norm))) {
      if (!isSqlAliasWord(m[1])) continue;
      if (new RegExp('\\b' + m[1] + '\\.').test(norm)) return true;
    }
    return false;
  }

  function hasTop50Limit(code, norm) {
    if (/\bfetch\s+(?:first|next)\s+50\s+rows\s+only\b/i.test(norm)) return true;
    if (/\brownum\s*<=?\s*50\b/i.test(norm)) return true;
    if (/\boffset\s+\d+\s+rows\s+fetch\s+next\s+50\s+rows\s+only\b/i.test(norm)) return true;
    return /\bselect\b[\s\S]{0,300}\b50\b/i.test(norm) &&
      /\border\s+by\b/i.test(norm) &&
      /\b(fetch|rownum|offset|top)\b/i.test(norm);
  }

  function hasSelect10Percent(code, norm) {
    if (/\bfetch\s+first\s+10\s+percent\s+rows\s+only\b/i.test(norm)) return true;
    if (/\bsample\s*\(\s*10\s*\)/i.test(norm)) return true;
    if (/\brownum\s*<=?\s*ceil\s*\(/i.test(norm)) return true;
    if (/\brownum\s*<=?\s*\(?\s*select\s+count/i.test(norm) && /0\.1|10\s*percent|\*\s*0\.1/i.test(norm)) return true;
    return /\b10\s*%\b/.test(code) && /\bSELECT\b/i.test(code);
  }

  function blockHasAdjacentComment(blocks, idx) {
    if (blockHasOwnComment(blocks[idx])) return true;
    if (idx > 0 && blockIsCommentOnly(blocks[idx - 1])) return true;
    if (idx < blocks.length - 1 && blockIsCommentOnly(blocks[idx + 1])) return true;
    return false;
  }

  /** Комментарий до или после каждого непрерывного блока команд (разделитель — пустая строка). */
  function hasBlockComments(code) {
    var blocks = splitCodeBlocks(code);
    var sqlIdx = [];
    blocks.forEach(function (b, i) {
      if (blockHasSql(b)) sqlIdx.push(i);
    });
    if (!sqlIdx.length) return false;
    return sqlIdx.every(function (i) { return blockHasAdjacentComment(blocks, i); });
  }

  function getAdjacentCommentText(code, start, end, radius) {
    radius = radius || 500;
    var chunk = code.slice(Math.max(0, start - radius), end + radius);
    return (chunk.match(/(--[^\n]*|\/\*[\s\S]*?\*\/)/g) || []).join(' ').toLowerCase();
  }

  function adjacentCommentMatch(code, stmtPred, commentRe) {
    var stmts = splitStatementsDetailed(code);
    for (var i = 0; i < stmts.length; i++) {
      if (!stmtPred(stmts[i].text)) continue;
      var txt = getAdjacentCommentText(code, stmts[i].start, stmts[i].end);
      if (commentRe.test(txt)) return true;
    }
    return false;
  }

  function detectSchema(sql) {
    var m = sql.match(/\b(\w+)\.(?:Agent|AGENTS|agents)\b/i);
    return m ? m[1].toLowerCase() : null;
  }

  function getSqlBlockLineRanges(code) {
    var lines = code.split('\n');
    var ranges = [];
    var blockStart = null;
    lines.forEach(function (line, i) {
      var ln = i + 1;
      if (line.trim() === '') {
        if (blockStart !== null) {
          ranges.push({ start: blockStart, end: ln - 1 });
          blockStart = null;
        }
      } else if (blockStart === null) {
        blockStart = ln;
      }
    });
    if (blockStart !== null) ranges.push({ start: blockStart, end: lines.length });
    return ranges.filter(function (r) {
      return blockHasSql(lines.slice(r.start - 1, r.end).join('\n'));
    });
  }

  function locateCriterionLines(code, criterionId) {
    var lines = {};
    function mark(start, end) {
      var a = posToLine(code, start);
      var b = posToLine(code, end == null ? start : end);
      for (var ln = a; ln <= b; ln++) lines[ln] = true;
    }
    function markLines(startLn, endLn) {
      for (var ln = startLn; ln <= endLn; ln++) lines[ln] = true;
    }
    var stmts = splitStatementsDetailed(code);
    var id = criterionId;

    stmts.forEach(function (s) {
      var sn = normalize(s.text);
      if (id === 'create_agent' || id === 'schema_create_agent') {
        if (/\bCREATE\s+TABLE\b/i.test(sn) && /\bAgent\b/i.test(s.text)) mark(s.start, s.end);
      } else if (id === 'alter_birth') {
        if (/\bALTER\s+TABLE\b/i.test(sn) && /\bdBirthDate\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'drop_not_delete') {
        if (/\b(?:DROP|DELETE)\s+(?:TABLE\s+)?[\w.]*Agent\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'ctas_agents' || id === 'ctas_partners') {
        if (/\bCREATE\s+TABLE\b/i.test(sn) && /\bSELECT\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'defaults') {
        if (/\bALTER\s+TABLE\b/i.test(sn) && /\bMODIFY\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'insert_agent' || id === 'insert_partner') {
        if (/\bINSERT\s+INTO\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'supervisor_alter') {
        if (/\bALTER\s+TABLE\b/i.test(sn) && /\bidsupervisor\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'supervisor_update_all') {
        if (/\bUPDATE\b/i.test(sn) && /\bidsupervisor\s*=\s*1000\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'supervisor_update_cond' || id === 'schema_second_update' || id === 'schema_update') {
        if (/\bUPDATE\b/i.test(sn) && (/\bidsupervisor\s*=\s*2000\b/i.test(sn) || /\bagency\s*=\s*1000\b/i.test(sn))) {
          mark(s.start, s.end);
        }
      } else if (id === 'aliases') {
        if (/\bUPDATE\b/i.test(sn) && !/\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./i.test(sn)) mark(s.start, s.end);
        if (/\bSELECT\b/i.test(sn) && !hasAnySelectAlias(sn)) mark(s.start, s.end);
        if (/\bDELETE\s+FROM\b/i.test(sn) && !hasAnyDeleteAlias(sn)) mark(s.start, s.end);
        if (/\bINSERT\s+INTO\b/i.test(sn) && !/\bINSERT\s+INTO\s+[\w.]+\s+\w+\s*\(/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'final_select' || id === 'select_fork_comment' || id === 'select_partners') {
        if (/\bSELECT\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'update_agency' || id === 'delete_agents_match') {
        if (/\b(?:UPDATE|DELETE)\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'create_and_deletes') {
        if (/\b(?:CREATE\s+TABLE|DELETE\s+FROM)\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'schema_create' || id === 'schema_create_agent') {
        if (/\bCREATE\s+TABLE\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'rollback_comment') {
        if (/\b(?:DELETE|ROLLBACK)\b/i.test(sn)) mark(s.start, s.end);
      } else if (id === 'merge_or_update') {
        if (/\b(?:UPDATE|MERGE)\b/i.test(sn)) mark(s.start, s.end);
      }
    });

    if (id === 'comments') {
      var blocks = splitCodeBlocks(code);
      var sqlIdx = [];
      blocks.forEach(function (b, i) {
        if (blockHasSql(b)) sqlIdx.push(i);
      });
      var pos = 0;
      sqlIdx.forEach(function (bi) {
        if (blockHasAdjacentComment(blocks, bi)) return;
        var b = blocks[bi];
        var start = code.indexOf(b, pos);
        if (start < 0) start = code.indexOf(b);
        if (start >= 0) mark(start, start + b.length);
        pos = start >= 0 ? start + b.length : pos;
      });
    }

    if (id === 'select_fork_comment') {
      getSqlBlockLineRanges(code).forEach(function (r) {
        var chunk = code.split('\n').slice(r.start - 1, r.end).join('\n');
        if (/\bSELECT\b/i.test(chunk) && /\bcontract_date\b/i.test(chunk)) markLines(r.start, r.end);
      });
    }

    return Object.keys(lines).map(Number).sort(function (a, b) { return a - b; });
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

  var SQL_KW = 'CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|FROM|WHERE|SET|TABLE|AS|INTO|ADD|MODIFY|DEFAULT|COMMIT|NUMBER|VARCHAR2|VARCHAR|DATE|ORDER|BY|FETCH|FIRST|ROWS|ONLY|JOIN|ON|AND|OR|NOT|NULL|IS|IN|VALUES|NEXTVAL|TO_DATE|TRUNCATE|GRANT|REVOKE|BEGIN|DECLARE|EXEC|EXECUTE|PRIMARY|KEY|CONSTRAINT|INDEX|VIEW|SEQUENCE|UNION|ALL|DISTINCT|GROUP|HAVING|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|CAST|PURGE|MERGE|ROW_NUMBER|DENSE_RANK|RANK|SAMPLE|SYSDATE|ROLLBACK';

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
    hasBlockComments: hasBlockComments,
    countDefaultFields: countDefaultFields,
    hasInsertBeginDateSep2025: hasInsertBeginDateSep2025,
    hasAnyUpdateAlias: hasAnyUpdateAlias,
    hasAnyDeleteAlias: hasAnyDeleteAlias,
    hasAnySelectAlias: hasAnySelectAlias,
    hasTop50Limit: hasTop50Limit,
    hasSelect10Percent: hasSelect10Percent,
    adjacentCommentMatch: adjacentCommentMatch,
    detectSchema: detectSchema,
    locateCriterionLines: locateCriterionLines,
    RE_UPDATE_SET: RE_UPDATE_SET,
    RE_UPDATE_SCHEMA: RE_UPDATE_SCHEMA,
    stmtMatch: stmtMatch,
    allStmts: allStmts,
    countMatches: countMatches,
    highlightSql: highlightSql
  };
})();
