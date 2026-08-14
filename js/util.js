/* eslint-disable no-unused-vars */
var SqlUtil = (function () {
  function stripComments(sql) {
    return sql
      .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ')
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

  var SQL_START = /^(WITH|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|COMMIT|ROLLBACK|SAVEPOINT|TRUNCATE|GRANT|REVOKE|SET|BEGIN|DECLARE|EXEC|EXECUTE|MERGE)\b/i;

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
    return !normalize(block);
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
    if (/\bto_date\s*\(\s*'0?1[\.\/-]0?9[\.\/-]2025'/i.test(code)) return true;
    if (/\bto_date\s*\(\s*'2025[\.\/-]0?9[\.\/-]0?1'/i.test(code)) return true;
    if (/\bdate\s+'2025-09-01'/i.test(norm)) return true;
    if (/\b01-SEP-2025\b/i.test(code)) return true;
    if (/\bbegin_date\b/i.test(norm) && /\b0?1[\.\/-]0?9[\.\/-]2025\b/i.test(code)) return true;
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
    var patterns = [
      /\bFROM\s+[\w.]+\s+(\w+)\b/gi,
      /\bJOIN\s+[\w.]+\s+(\w+)\b/gi,
      /\bFROM\s*\([\s\S]*?\)\s+(\w+)\b/gi
    ];
    for (var p = 0; p < patterns.length; p++) {
      var re = patterns[p];
      var m;
      while ((m = re.exec(norm))) {
        if (!isSqlAliasWord(m[1])) continue;
        if (new RegExp('\\b' + m[1] + '\\.').test(norm)) return true;
      }
    }
    return false;
  }

  function hasTop50Limit(code, norm) {
    if (/\bfetch\s+(?:first|next)\s+50\s+rows?\s+(?:only|with\s+ties)\b/i.test(norm)) return true;
    if (/\brownum\s*<=?\s*50\b/i.test(norm)) return true;
    if (/\boffset\s+\d+\s+rows?\s+fetch\s+next\s+50\s+rows?\s+(?:only|with\s+ties)\b/i.test(norm)) return true;
    return /\bselect\b[\s\S]{0,300}\b50\b/i.test(norm) &&
      /\border\s+by\b/i.test(norm) &&
      /\b(fetch|rownum|offset|top)\b/i.test(norm);
  }

  function hasSelect10Percent(code, norm) {
    if (/\bfetch\s+first\s+10\s+percent\s+rows?\s+(?:only|with\s+ties)\b/i.test(norm)) return true;
    if (/\bsample(?:\s+block)?\s*\(\s*10\s*\)/i.test(norm)) return true;
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

  function locateMissingAdjacentComment(code, stmtPred, commentRe) {
    var lines = {};
    splitStatementsDetailed(code).forEach(function (s) {
      if (!stmtPred(s.text)) return;
      if (commentRe.test(getAdjacentCommentText(code, s.start, s.end))) return;
      var a = posToLine(code, s.start);
      var b = posToLine(code, s.end);
      for (var ln = a; ln <= b; ln++) lines[ln] = true;
    });
    return lines;
  }

  function locateBlocksMissingComments(code) {
    var lines = {};
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
      if (start < 0) return;
      var a = posToLine(code, start);
      var endPos = start + b.length;
      var endLn = posToLine(code, endPos);
      for (var ln = a; ln <= endLn; ln++) lines[ln] = true;
      pos = endPos;
    });
    return lines;
  }

  function mergeLineMaps() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) {
      var src = arguments[i];
      Object.keys(src).forEach(function (k) { out[k] = true; });
    }
    return out;
  }

  function stmtLines(code, s) {
    var lines = {};
    var a = posToLine(code, s.start);
    var b = posToLine(code, s.end);
    for (var ln = a; ln <= b; ln++) lines[ln] = true;
    return lines;
  }

  function locateByStmt(code, pred) {
    var lines = {};
    splitStatementsDetailed(code).forEach(function (s) {
      if (pred(s.text, normalize(s.text))) {
        Object.assign(lines, stmtLines(code, s));
      }
    });
    return lines;
  }

  var CRITERION_LOCATORS = {
    comments: function (code) { return locateBlocksMissingComments(code); },
    rollback_comment: function (code) {
      return locateMissingAdjacentComment(code, function (s) {
        return /\bDELETE\s+FROM\b/i.test(s);
      }, /rollback|откат|commit|восстанов|вернуть/);
    },
    select_fork_comment: function (code) {
      return locateMissingAdjacentComment(code, function (s) {
        return /\bSELECT\b/i.test(s) && (/\bcontract_date\b/i.test(s) || /\badmdate\b/i.test(s) ||
          /\bfetch\b/i.test(s) || /\brownum\b/i.test(s) || /\b10\s*percent\b/i.test(s));
      }, /50|сорт|sort|fetch|rownum|строк|выборк|order|contract|10\s*%|sample|percent|процент|случайн|перв/);
    },
    distinct_comment: function (code) {
      return locateMissingAdjacentComment(code, function (s) {
        return /\bINSERT\b/i.test(s) && /\bi3\.products\b/i.test(s);
      }, /distinct|ключ|key|primary|unique|i3\.products|products/);
    },
    delete_fork_comment: function (code) {
      return locateMissingAdjacentComment(code, function (s) {
        return /\bDELETE\s+FROM\b/i.test(s);
      }, /50|10|половин|десят|rownum|percent|%/);
    },
    gaps_comment: function (code) {
      return locateMissingAdjacentComment(code, function (s) {
        return /\bUPDATE\b/i.test(s) && /\bpartner\b/i.test(s);
      }, /25|дыр|gap|нумер|row_number|rank|dense_rank|все|all|запис/);
    },
    create_agent: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bAgent\b/i.test(t);
      });
    },
    schema_create_agent: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bAgent\b/i.test(t) && !/\bCREATE\s+TABLE\s+\w+\./i.test(n);
      });
    },
    alter_birth: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bdBirthDate\b/i.test(n);
      });
    },
    drop_not_delete: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\b(?:DROP|DELETE)\b/i.test(n) && /\bAgent\b/i.test(t);
      });
    },
    ctas_agents: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bAGENTS(?:_?\d+)?\b/i.test(t) && /\bSELECT\b/i.test(n);
      });
    },
    ctas_partners: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(t) && /\bSELECT\b/i.test(n);
      });
    },
    ctas_partners_full: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(t) && /\bSELECT\b/i.test(n);
      });
    },
    defaults: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bMODIFY\b/i.test(n);
      });
    },
    insert_agent: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bINSERT\s+INTO\b/i.test(n) && /\bAGENTS(?:_?\d+)?\b/i.test(n);
      });
    },
    insert_partner: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bINSERT\s+INTO\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n);
      });
    },
    supervisor_alter: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bidsupervisor\b/i.test(n);
      });
    },
    supervisor_update_all: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bidsupervisor\s*=\s*1000\b/i.test(n);
      });
    },
    supervisor_update_cond: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bidsupervisor\s*=\s*2000\b/i.test(n);
      });
    },
    schema_second_update: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bidsupervisor\s*=\s*2000\b/i.test(n) &&
          !RE_UPDATE_SCHEMA.test(n);
      });
    },
    schema_create: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && (
          !/\bCREATE\s+TABLE\s+\w+\./i.test(n) ||
          (/\bpartnersCopy\b/i.test(n) || /\bInsuran[cs]eTypes\b/i.test(t))
        );
      });
    },
    schema_update: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bagency\s*=\s*1000\b/i.test(n) && !RE_UPDATE_SCHEMA.test(n);
      });
    },
    aliases: function (code) {
      var lines = {};
      splitStatementsDetailed(code).forEach(function (s) {
        var n = normalize(s.text);
        var bad = (/\bUPDATE\b/i.test(n) && !/\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./i.test(n)) ||
          (/\bSELECT\b/i.test(n) && !hasAnySelectAlias(n)) ||
          (/\bDELETE\s+FROM\b/i.test(n) && !hasAnyDeleteAlias(n)) ||
          (/\bINSERT\s+INTO\b/i.test(n) && !/\bINSERT\s+INTO\s+[\w.]+\s+\w+\s*\(/i.test(n) &&
            !/\bFROM\s+[\w.]+\s+(\w+)\b/i.test(n));
        if (bad) Object.assign(lines, stmtLines(code, s));
      });
      return lines;
    },
    final_select: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bSELECT\b/i.test(n) && /\bagent\b/i.test(n);
      });
    },
    alter_agent: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n) && /\bMODIFY\b/i.test(n);
      });
    },
    delete_all: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bDELETE\s+FROM\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n);
      });
    },
    select_10pct: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bSELECT\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n);
      });
    },
    create_partnersCopy: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bpartnersCopy\b/i.test(n);
      });
    },
    modify_text: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bpartnersCopy\b/i.test(n) && /\bMODIFY\b/i.test(n);
      });
    },
    create_insuranceTypes: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bCREATE\s+TABLE\b/i.test(n) && /\bInsuran[cs]eTypes\b/i.test(t);
      });
    },
    insert_all_5: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bINSERT\s+ALL\b/i.test(n) && /\bInsuran[cs]eTypes\b/i.test(n);
      });
    },
    insert_products: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\b(?:INSERT|SELECT)\b/i.test(n) && /\bi3\.products\b/i.test(t);
      });
    },
    truncate: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bTRUNCATE\s+TABLE\b/i.test(n) && /\bpartnersCopy\b/i.test(n);
      });
    },
    update_agency: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bagents(?:_?\d+)?\b/i.test(n);
      });
    },
    create_and_deletes: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\b(?:CREATE\s+TABLE|DELETE\s+FROM)\b/i.test(n);
      });
    },
    delete_agents_match: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bDELETE\s+FROM\b/i.test(n) && /\bagents(?:_?\d+)?\b/i.test(n);
      });
    },
    add_emergency_col: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bALTER\s+TABLE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n) && /\bADD\b/i.test(n);
      });
    },
    update_phone_mail: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n);
      });
    },
    drop_purge: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bDROP\s+TABLE\b/i.test(n);
      });
    },
    insert_all_agents: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bINSERT\s+ALL\b/i.test(n) && /\bagents(?:_?\d+)?\b/i.test(n);
      });
    },
    update_partner_gaps: function (code) {
      return locateByStmt(code, function (t, n) {
        return /\bUPDATE\b/i.test(n) && /\bpartners(?:_?\d+)?\b/i.test(n) && /\bpartner\b/i.test(n);
      });
    }
  };

  function locateCriterionLines(code, criterionId) {
    if (!code || !criterionId) return [];
    var fn = CRITERION_LOCATORS[criterionId];
    var lines = fn ? fn(code) : {};
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

  var SQL_KW = 'WITH|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|FROM|WHERE|SET|TABLE|AS|INTO|ADD|MODIFY|DEFAULT|COMMIT|NUMBER|VARCHAR2|VARCHAR|DATE|ORDER|BY|FETCH|FIRST|ROWS|ONLY|JOIN|ON|AND|OR|NOT|NULL|IS|IN|VALUES|NEXTVAL|TO_DATE|TRUNCATE|GRANT|REVOKE|BEGIN|DECLARE|EXEC|EXECUTE|PRIMARY|KEY|CONSTRAINT|INDEX|VIEW|SEQUENCE|UNION|ALL|DISTINCT|GROUP|HAVING|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|CAST|PURGE|MERGE|ROW_NUMBER|DENSE_RANK|RANK|SAMPLE|SYSDATE|ROLLBACK|SAVEPOINT';

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightLine(line, inBlock) {
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
      if (inBlock) {
        var endBlk = rest.indexOf('*/');
        if (endBlk === -1) {
          parts.push('<span class="hl-cmt">' + escHtml(rest) + '</span>');
          return { html: parts.join('') || ' ', inBlock: true };
        }
        parts.push('<span class="hl-cmt">' + escHtml(rest.slice(0, endBlk + 2)) + '</span>');
        i += endBlk + 2;
        inBlock = false;
        continue;
      }
      if (rest.match(/^--/)) {
        parts.push('<span class="hl-cmt">' + escHtml(rest) + '</span>');
        break;
      }
      if (rest.slice(0, 2) === '/*') {
        var endCmt = rest.indexOf('*/', 2);
        if (endCmt === -1) {
          parts.push('<span class="hl-cmt">' + escHtml(rest) + '</span>');
          return { html: parts.join('') || ' ', inBlock: true };
        }
        parts.push('<span class="hl-cmt">' + escHtml(rest.slice(0, endCmt + 2)) + '</span>');
        i += endCmt + 2;
        continue;
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
      var next = rest.search(/(?:--|'|"|\/\*|\d)/);
      if (next === -1) { pushPlain(rest); break; }
      if (next > 0) { pushPlain(rest.slice(0, next)); i += next; continue; }
      parts.push(escHtml(rest[0]));
      i++;
    }
    return { html: parts.join('') || ' ', inBlock: false };
  }

  function highlightSql(code) {
    var inBlock = false;
    return code.split('\n').map(function (ln) {
      var r = highlightLine(ln, inBlock);
      inBlock = r.inBlock;
      return r.html;
    });
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
