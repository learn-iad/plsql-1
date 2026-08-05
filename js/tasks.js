/* eslint-disable no-unused-vars */
var TASKS = [
  {
    id: 'task1_agents',
    title: 'Задание 1 — Agent / AGENTS',
    passScore: 75,
    html: '<p><b>Инструкция.</b> Если в решении есть развилка (несколько трактовок, дополнительная команда, выбор подхода) — обязательно поясните её в комментарии в SQL-коде.</p>' +
      '<ol style="margin:8px 0;padding-left:20px;line-height:1.55">' +
      '<li>Создайте таблицу <b>Agent</b>: Id (NUMBER), sLogin (VARCHAR2 150), sPassword (VARCHAR2 30).</li>' +
      '<li>Добавьте столбец <b>dBirthDate</b> (DATE).</li>' +
      '<li>Удалите таблицу <b>с возможностью восстановления</b> (DROP, не DELETE).</li>' +
      '<li>Скопируйте <b>edu.agents</b> в AGENTS (CREATE TABLE … AS SELECT).</li>' +
      '<li>Задайте значения по умолчанию для: end_date, auto_fix_comm, is_ichp, is_filial, top_filial, in_premium, ichp_old, idrappeltype, lnetwork_develop.</li>' +
      '<li>INSERT: agent = edu.seqEduAgents.nextval, nrating = 99, begin_date = 01.09.2025. Не забудьте COMMIT в PL/SQL Developer.</li>' +
      '<li>ALTER ADD idsupervisor; UPDATE всех = 1000; UPDATE agent &lt; 500 → idsupervisor = 2000.</li>' +
      '<li>SELECT: agent, sname, nrating, idsupervisor, top_filial — 50 строк, сортировка по дате контракта.</li>' +
      '</ol>' +
      '<p style="margin-top:10px;font-size:.88rem;color:#94a3b8">Критерии: работоспособность · комментарии · схема перед таблицами · алиасы в UPDATE/SELECT.</p>',
    rubric: [
      {
        id: 'comments',
        label: 'Есть комментарии в коде',
        weight: 8,
        hint: 'Добавьте -- или /* */ с пояснением развилок и решений.',
        check: function (code) {
          return { pass: SqlUtil.hasComments(code), detail: SqlUtil.hasComments(code) ? 'Комментарии найдены' : 'Комментарии не найдены' };
        }
      },
      {
        id: 'create_agent',
        label: 'CREATE TABLE Agent с нужными полями',
        weight: 10,
        hint: 'id NUMBER, sLogin VARCHAR2(150), sPassword VARCHAR2(30).',
        check: function (code) {
          var n = SqlUtil.normalize(code);
          var ok = /\bCREATE\s+TABLE\s+\w+\.Agent\s*\(/i.test(n) &&
            /\bid\s+NUMBER\b/i.test(n) &&
            /\bsLogin\s+VARCHAR2\s*\(\s*150\s*\)/i.test(n) &&
            /\bsPassword\s+VARCHAR2\s*\(\s*30\s*\)/i.test(n);
          return { pass: ok };
        }
      },
      {
        id: 'schema_create_agent',
        label: 'Схема перед Agent при CREATE',
        weight: 6,
        hint: 'Например: student_schema.Agent',
        check: function (code) {
          var ok = /\bCREATE\s+TABLE\s+\w+\.Agent\b/i.test(SqlUtil.normalize(code));
          return { pass: ok };
        }
      },
      {
        id: 'alter_birth',
        label: 'ALTER ADD dBirthDate DATE',
        weight: 8,
        check: function (code) {
          var ok = /\bALTER\s+TABLE\s+[\w.]+\s+ADD\s+dBirthDate\s+DATE\b/i.test(SqlUtil.normalize(code));
          return { pass: ok };
        }
      },
      {
        id: 'drop_not_delete',
        label: 'DROP TABLE (не DELETE FROM)',
        weight: 10,
        hint: 'Нужен DROP TABLE — удаление объекта, а не строк.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var hasDrop = /\bDROP\s+TABLE\s+[\w.]*Agent\b/i.test(norm);
          var hasDelete = /\bDELETE\s+FROM\s+[\w.]*Agent\b/i.test(norm);
          if (hasDelete && !hasDrop) return { pass: false, detail: 'Обнаружен DELETE FROM вместо DROP' };
          return { pass: hasDrop };
        }
      },
      {
        id: 'ctas_agents',
        label: 'CREATE TABLE AGENTS AS SELECT из edu.agents',
        weight: 10,
        check: function (code) {
          var ok = /\bCREATE\s+TABLE\s+[\w.]*AGENTS\s+AS\s*\(?\s*SELECT\b/i.test(SqlUtil.normalize(code)) &&
            /\bedu\.agents\b/i.test(code);
          return { pass: ok };
        }
      },
      {
        id: 'defaults',
        label: 'ALTER MODIFY — значения по умолчанию (9 полей)',
        weight: 12,
        hint: 'end_date, auto_fix_comm, is_ichp, is_filial, top_filial, in_premium, ichp_old, idrappeltype, lnetwork_develop.',
        check: function (code) {
          var fields = ['end_date', 'auto_fix_comm', 'is_ichp', 'is_filial', 'top_filial', 'in_premium', 'ichp_old', 'idrappeltype', 'lnetwork_develop'];
          var norm = SqlUtil.normalize(code);
          var found = fields.filter(function (f) {
            return new RegExp('\\bALTER\\s+TABLE\\s+[\\w.]+\\s+MODIFY\\s+' + f + '\\s+DEFAULT\\b', 'i').test(norm);
          });
          return { pass: found.length >= 7, detail: found.length + '/9 полей с DEFAULT' };
        }
      },
      {
        id: 'insert_agent',
        label: 'INSERT агента (seq, nrating=99, begin_date)',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bINSERT\s+INTO\s+[\w.]*AGENTS\b/i.test(norm) &&
            /edu\.seqEduAgents\.nextval/i.test(code) &&
            /\bnrating\b/i.test(norm) && /\b99\b/.test(norm) &&
            (/\bbegin_date\b/i.test(norm) && (/\b01[\.\/-]09[\.\/-]2025\b/i.test(code) || /\b01-SEP-2025\b/i.test(code) || /\bto_date\s*\(\s*'01\.09\.2025'/i.test(code)));
          return { pass: ok };
        }
      },
      {
        id: 'supervisor_alter',
        label: 'ALTER ADD idsupervisor',
        weight: 5,
        check: function (code) {
          return { pass: /\bALTER\s+TABLE\s+[\w.]*AGENTS\s+ADD\s+idsupervisor\s+NUMBER\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'supervisor_update_all',
        label: 'UPDATE idsupervisor = 1000 для всех',
        weight: 6,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          return { pass: /\bUPDATE\s+[\w.]+\s+\w+\s+SET\b/i.test(norm) && /\bidsupervisor\s*=\s*1000\b/i.test(norm) };
        }
      },
      {
        id: 'supervisor_update_cond',
        label: 'UPDATE idsupervisor = 2000 WHERE agent < 500',
        weight: 8,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          return { pass: /\bidsupervisor\s*=\s*2000\b/i.test(norm) && /\bagent\s*<\s*500\b/i.test(norm) };
        }
      },
      {
        id: 'schema_second_update',
        label: 'Схема во втором UPDATE (agent < 500)',
        weight: 6,
        hint: 'UPDATE student_schema.agents ag …',
        check: function (code) {
          var stmts = SqlUtil.splitStatements(code);
          var hit = stmts.some(function (s) {
            return /\bidsupervisor\s*=\s*2000\b/i.test(s) && /\bagent\s*<\s*500\b/i.test(s) &&
              /\bUPDATE\s+\w+\.\w+\s+\w+\s+SET\b/i.test(SqlUtil.normalize(s));
          });
          return { pass: hit };
        }
      },
      {
        id: 'aliases',
        label: 'Алиасы таблиц в UPDATE/SELECT',
        weight: 7,
        hint: 'UPDATE agents ag SET ag.col … ; FROM AGENTS ag',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var upd = /\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./i.test(norm);
          var selM = norm.match(/\bSELECT\b[\s\S]*?\bFROM\s+[\w.]+\s+(\w+)\b/i);
          var sel = selM && new RegExp('\\b' + selM[1] + '\\.').test(norm);
          return { pass: upd && sel, detail: 'UPDATE alias: ' + upd + ', SELECT alias: ' + sel };
        }
      },
      {
        id: 'final_select',
        label: 'SELECT нужных полей, ORDER BY contract_date, TOP 50',
        weight: 10,
        hint: 'FETCH FIRST 50 ROWS ONLY / ROWNUM <= 50 — с обоснованием в комментарии.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var cols = ['agent', 'sname', 'nrating', 'idsupervisor', 'top_filial'];
          var allCols = cols.every(function (c) { return new RegExp('\\b' + c + '\\b', 'i').test(norm); });
          var order = /\border\s+by\b[\s\S]*\bcontract_date\b/i.test(norm);
          var top50 = /\bfetch\s+first\s+50\s+rows\s+only\b/i.test(norm) ||
            /\brownum\s*<=?\s*50\b/i.test(norm) ||
            (/\bselect\b[\s\S]{0,200}\b50\b/i.test(norm) && /\border\s+by\b/i.test(norm));
          return { pass: allCols && order && top50, detail: [allCols, order, top50].join('/') };
        }
      },
      {
        id: 'select_fork_comment',
        label: 'Комментарий к трактовке TOP 50 / сортировки',
        weight: 4,
        hint: 'Поясните порядок сортировки и отбора 50 строк.',
        check: function (code) {
          if (!/\bSELECT\b[\s\S]*\bcontract_date\b/i.test(code)) return { pass: false, detail: 'Нет SELECT с contract_date' };
          var comments = (code.match(/(--[^\n]*|\/\*[\s\S]*?\*\/)/g) || []).join(' ').toLowerCase();
          var ok = /50|сорт|sort|fetch|rownum|строк|выборк|order|contract/.test(comments);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий к SELECT' };
        }
      }
    ]
  }
];
