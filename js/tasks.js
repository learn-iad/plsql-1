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
        label: 'Комментарии у блоков команд',
        weight: 8,
        hint: 'Пустая строка отделяет блоки — у каждого блока комментарий до или после.',
        check: function (code) {
          var ok = SqlUtil.hasBlockComments(code);
          return { pass: ok, detail: ok ? 'Комментарии у блоков найдены' : 'Добавьте комментарий до или после каждого блока команд' };
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
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bSELECT\b/i.test(s) && /\bcontract_date\b/i.test(s);
          }, /50|сорт|sort|fetch|rownum|строк|выборк|order|contract/);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий к SELECT' };
        }
      }
    ],
    checklist: [
      { label: 'Комментарии', ids: ['comments', 'select_fork_comment'] },
      { label: 'Схема', ids: ['schema_create_agent', 'schema_second_update'] },
      { label: 'Таблица Agent', ids: ['create_agent', 'alter_birth', 'drop_not_delete'] },
      { label: 'Копирование в AGENTS', ids: ['ctas_agents'] },
      { label: 'Значения по умолчанию', ids: ['defaults'] },
      { label: 'Новая запись', ids: ['insert_agent'] },
      { label: 'idsupervisor', ids: ['supervisor_alter', 'supervisor_update_all', 'supervisor_update_cond'] },
      { label: 'Алиасы', ids: ['aliases'] },
      { label: 'Итоговая выборка', ids: ['final_select'] }
    ]
  },
  {
    id: 'task2_partners',
    title: 'Задание 2 — Partners: копирование и выборка',
    passScore: 75,
    html: '<p><b>Инструкция.</b> Если в решении есть развилка (несколько трактовок, дополнительная команда, выбор подхода) — обязательно поясните её в комментарии в SQL-коде.</p>' +
      '<ol style="margin:8px 0;padding-left:20px;line-height:1.55">' +
      '<li>Скопируйте таблицу партнёров из <b>edu.partners</b>, но только поля: <b>partner, name, man, agent, admdate</b> (CREATE TABLE … AS SELECT).</li>' +
      '<li>Добавьте партнёра: partner = 1; name = «Тестов Тест Тестович»; man = «Y»; agent = 1000; admdate = текущая дата и время (SYSDATE).</li>' +
      '<li>Удалите все записи из таблицы партнёров (DELETE FROM).</li>' +
      '<li>Проверьте, можно ли вернуть данные (ROLLBACK) — поясните в комментарии.</li>' +
      '<li>SELECT: поля partner, name, man, agent, admdate; верните <b>10% строк</b> из выборки, отсортировав по дате <b>по убыванию</b> (FETCH FIRST 10 PERCENT ROWS ONLY или SAMPLE — с комментарием к выбору).</li>' +
      '</ol>' +
      '<p style="margin-top:10px;font-size:.88rem;color:#94a3b8">Критерии: работоспособность · комментарии · схема перед таблицами · алиасы в SELECT/INSERT/UPDATE.</p>',
    rubric: [
      {
        id: 'comments',
        label: 'Комментарии у блоков команд',
        weight: 8,
        hint: 'Пустая строка отделяет блоки — у каждого блока комментарий до или после.',
        check: function (code) {
          var ok = SqlUtil.hasBlockComments(code);
          return { pass: ok, detail: ok ? 'Комментарии у блоков найдены' : 'Добавьте комментарий до или после каждого блока команд' };
        }
      },
      {
        id: 'schema_create',
        label: 'Схема перед partners при CREATE',
        weight: 8,
        hint: 'Например: student_schema.partners',
        check: function (code) {
          return { pass: /\bCREATE\s+TABLE\s+\w+\.partners\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'ctas_partners',
        label: 'CREATE TABLE partners AS SELECT нужных полей из edu.partners',
        weight: 14,
        hint: 'partner, name, man, agent, admdate из edu.partners.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var cols = ['partner', 'name', 'man', 'agent', 'admdate'];
          var allCols = cols.every(function (c) { return new RegExp('\\b' + c + '\\b', 'i').test(norm); });
          var ok = /\bCREATE\s+TABLE\s+[\w.]*partners\s+AS\b/i.test(norm) &&
            /\bedu\.partners\b/i.test(code) && allCols;
          return { pass: ok, detail: allCols ? 'Поля найдены' : 'Не все поля' };
        }
      },
      {
        id: 'alter_agent',
        label: 'ALTER MODIFY agent (увеличение VARCHAR2)',
        weight: 8,
        hint: 'agent = 1000 не поместится в VARCHAR2(1) — измените тип.',
        check: function (code) {
          return { pass: /\bALTER\s+TABLE\s+[\w.]*partners\s+MODIFY\b[\s\S]*\bagent\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'insert_partner',
        label: 'INSERT партнёра с нужными значениями',
        weight: 12,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bINSERT\s+INTO\s+[\w.]*partners\b/i.test(norm) &&
            /\bpartner\b/i.test(norm) && /\b1\b/.test(norm) &&
            /Тестов\s+Тест\s+Тестович/i.test(code) &&
            /\bman\b/i.test(norm) && /'Y'/i.test(code) &&
            /\bagent\b/i.test(norm) && /\b1000\b/.test(norm) &&
            (/\badmdate\b/i.test(norm) && (/\bsysdate\b/i.test(norm) || /\bsystimestamp\b/i.test(norm)));
          return { pass: ok };
        }
      },
      {
        id: 'delete_all',
        label: 'DELETE FROM partners (все записи)',
        weight: 10,
        check: function (code) {
          return { pass: /\bDELETE\s+FROM\s+[\w.]*partners\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'rollback_comment',
        label: 'Комментарий про ROLLBACK',
        weight: 6,
        hint: 'Поясните, что DELETE можно отменить через ROLLBACK до COMMIT.',
        check: function (code) {
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bDELETE\s+FROM\b/i.test(s);
          }, /rollback|откат|commit|восстанов|вернуть/);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий про ROLLBACK' };
        }
      },
      {
        id: 'select_10pct',
        label: 'SELECT 10% строк, ORDER BY admdate DESC',
        weight: 12,
        hint: 'FETCH FIRST 10 PERCENT ROWS ONLY или SAMPLE (10) — с комментарием.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var cols = ['partner', 'name', 'man', 'agent', 'admdate'];
          var allCols = cols.every(function (c) { return new RegExp('\\b' + c + '\\b', 'i').test(norm); });
          var order = /\border\s+by\b[\s\S]*\badmdate\b/i.test(norm) && /\bdesc\b/i.test(norm);
          var pct = /\bfetch\s+first\s+10\s+percent\s+rows\s+only\b/i.test(norm) ||
            /\bsample\s*\(\s*10\s*\)/i.test(norm) ||
            /\brownum\s*<=?\s*ceil\s*\(\s*[\w.]+\s*\*\s*0\.1\s*\)/i.test(norm) ||
            (/\b10\s*%\b/.test(code) && /\bSELECT\b/i.test(norm));
          return { pass: allCols && order && pct, detail: [allCols, order, pct].join('/') };
        }
      },
      {
        id: 'select_fork_comment',
        label: 'Комментарий к трактовке 10% / SAMPLE',
        weight: 4,
        check: function (code) {
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bSELECT\b/i.test(s) && (/\badmdate\b/i.test(s) || /\b10\s*percent\b/i.test(s) || /\bsample\b/i.test(s));
          }, /10\s*%|sample|fetch|percent|процент|случайн|перв/);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий к SELECT 10%' };
        }
      },
      {
        id: 'aliases',
        label: 'Алиасы таблиц в SELECT/INSERT',
        weight: 8,
        hint: 'FROM partners p; INSERT INTO schema.partners …',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var selM = norm.match(/\bSELECT\b[\s\S]*?\bFROM\s+[\w.]+\s+(\w+)\b/i);
          var sel = selM && new RegExp('\\b' + selM[1] + '\\.').test(norm);
          var ctasM = norm.match(/\bFROM\s+edu\.partners\s+(\w+)\b/i);
          var ctas = ctasM && new RegExp('\\b' + ctasM[1] + '\\.').test(norm);
          return { pass: sel || ctas, detail: 'SELECT alias: ' + sel + ', CTAS alias: ' + ctas };
        }
      }
    ],
    checklist: [
      { label: 'Комментарии', ids: ['comments', 'rollback_comment', 'select_fork_comment'] },
      { label: 'Схема', ids: ['schema_create'] },
      { label: 'Копирование partners', ids: ['ctas_partners', 'alter_agent'] },
      { label: 'INSERT и DELETE', ids: ['insert_partner', 'delete_all'] },
      { label: 'Выборка 10%', ids: ['select_10pct'] },
      { label: 'Алиасы', ids: ['aliases'] }
    ]
  },
  {
    id: 'task3_partnersCopy',
    title: 'Задание 3 — partnersCopy и InsuranceTypes',
    passScore: 75,
    html: '<p><b>Инструкция.</b> Если в решении есть развилка — поясните её в комментарии в SQL-коде.</p>' +
      '<ol style="margin:8px 0;padding-left:20px;line-height:1.55">' +
      '<li>Создайте <b>partnersCopy</b> на основе <b>edu.claim_claims</b> с доп. столбцом <b>lBlocked</b> (шаблон: CREATE TABLE … AS SELECT ttc.*, CAST(NULL AS VARCHAR2(1)) AS lBlocked FROM …).</li>' +
      '<li>Увеличьте лимит во <b>всех текстовых полях</b> (ALTER TABLE … MODIFY).</li>' +
      '<li>Создайте таблицу <b>InsuranceTypes</b>: id (NUMBER), sname (VARCHAR2 50), sdefault_table_name (VARCHAR2 30). Добавьте <b>5 записей</b> одним оператором (INSERT ALL).</li>' +
      '<li>Добавьте все уникальные виды страхования из <b>i3.products</b> (INSERT … SELECT DISTINCT …). Посмотрите ключи i3.products (View → Keys) и <b>обоснуйте в комментарии</b>, нужен ли DISTINCT.</li>' +
      '<li>Удалите данные из partnersCopy <b>без возможности восстановления</b> (TRUNCATE).</li>' +
      '</ol>' +
      '<p style="margin-top:10px;font-size:.88rem;color:#94a3b8">Критерии: работоспособность · комментарии · схема перед таблицами · алиасы.</p>',
    rubric: [
      {
        id: 'comments',
        label: 'Комментарии у блоков команд',
        weight: 8,
        check: function (code) {
          return { pass: SqlUtil.hasBlockComments(code) };
        }
      },
      {
        id: 'schema_create',
        label: 'Схема перед своими таблицами',
        weight: 8,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bCREATE\s+TABLE\s+\w+\.partnersCopy\b/i.test(norm) &&
            /\bCREATE\s+TABLE\s+\w+\.InsuranceTypes\b/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'create_partnersCopy',
        label: 'CREATE partnersCopy из edu.claim_claims + lBlocked',
        weight: 14,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bCREATE\s+TABLE\s+[\w.]*partnersCopy\s+AS\b/i.test(norm) &&
            /\bedu\.claim_claims\b/i.test(code) &&
            /\blBlocked\b/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'modify_text',
        label: 'ALTER MODIFY — увеличение текстовых полей',
        weight: 10,
        hint: 'ALTER TABLE … MODIFY (status, note, …).',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bALTER\s+TABLE\s+[\w.]*partnersCopy\s+MODIFY\b/i.test(norm) &&
            /\b(varchar2|varchar)\s*\(\s*\d+\s*\)/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'create_insuranceTypes',
        label: 'CREATE TABLE InsuranceTypes с нужными полями',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bCREATE\s+TABLE\s+[\w.]*InsuranceTypes\b/i.test(norm) &&
            /\bid\s+NUMBER\b/i.test(norm) &&
            /\bsname\s+VARCHAR2\s*\(\s*50\s*\)/i.test(norm) &&
            /\bsdefault_table_name\s+VARCHAR2\s*\(\s*30\s*\)/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'insert_all_5',
        label: 'INSERT ALL — 5 записей в InsuranceTypes',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bINSERT\s+ALL\b/i.test(norm) &&
            /\bINTO\s+[\w.]*InsuranceTypes\b/i.test(norm) &&
            (SqlUtil.countMatches(code, /\bINTO\s+[\w.]*InsuranceTypes\b/gi) >= 5 ||
              SqlUtil.countMatches(code, /\bINTO\s+[\w.]*insurancetypes\b/gi) >= 5);
          return { pass: ok };
        }
      },
      {
        id: 'insert_products',
        label: 'INSERT из i3.products (уникальные виды страхования)',
        weight: 12,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bINSERT\s+INTO\s+[\w.]*InsuranceTypes\b/i.test(norm) &&
            /\bSELECT\b[\s\S]*\bFROM\s+i3\.products\b/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'distinct_comment',
        label: 'Комментарий про DISTINCT и ключи i3.products',
        weight: 6,
        hint: 'Обоснуйте, нужен ли DISTINCT, исходя из ключей таблицы.',
        check: function (code) {
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bINSERT\b/i.test(s) && /\bi3\.products\b/i.test(s);
          }, /distinct|ключ|key|primary|unique|i3\.products|products/);
          return { pass: ok, detail: ok ? 'Обоснование найдено' : 'Добавьте комментарий про DISTINCT' };
        }
      },
      {
        id: 'truncate',
        label: 'TRUNCATE partnersCopy (без восстановления)',
        weight: 10,
        check: function (code) {
          return { pass: /\bTRUNCATE\s+TABLE\s+[\w.]*partnersCopy\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'aliases',
        label: 'Алиасы таблиц в SELECT/INSERT',
        weight: 6,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var prodM = norm.match(/\bFROM\s+i3\.products\s+(\w+)\b/i);
          var prod = prodM && new RegExp('\\b' + prodM[1] + '\\.').test(norm);
          var ccM = norm.match(/\bFROM\s+edu\.claim_claims\s+(\w+)\b/i);
          var cc = ccM && new RegExp('\\b' + ccM[1] + '\\.').test(norm);
          return { pass: prod && cc, detail: 'products alias: ' + prod + ', claim_claims alias: ' + cc };
        }
      }
    ],
    checklist: [
      { label: 'Комментарии', ids: ['comments', 'distinct_comment'] },
      { label: 'Схема', ids: ['schema_create'] },
      { label: 'partnersCopy', ids: ['create_partnersCopy', 'modify_text'] },
      { label: 'InsuranceTypes', ids: ['create_insuranceTypes', 'insert_all_5', 'insert_products'] },
      { label: 'TRUNCATE', ids: ['truncate'] },
      { label: 'Алиасы', ids: ['aliases'] }
    ]
  },
  {
    id: 'task4_agents_update',
    title: 'Задание 4 — UPDATE agents и DELETE',
    passScore: 75,
    html: '<p><b>Инструкция.</b> Если в решении есть развилка — поясните её в комментарии в SQL-коде.</p>' +
      '<ol style="margin:8px 0;padding-left:20px;line-height:1.55">' +
      '<li>UPDATE в вашей копии <b>agents</b>: у агента с самым долгим сроком работы (<b>CONTRACT_DATE</b>) установите <b>AGENCY = 1000</b>.</li>' +
      '<li>Создайте любую таблицу и удалите из неё: <b>все записи</b>; <b>половину</b>; <b>десятую часть</b> записей.</li>' +
      '<li>Удалите в копии <b>agents</b> записи, где <b>agent</b> равен <b>partner</b> из <b>edu.partners</b>.</li>' +
      '</ol>' +
      '<p style="margin-top:10px;font-size:.88rem;color:#94a3b8">Критерии: работоспособность · комментарии · схема перед таблицами · алиасы.</p>',
    rubric: [
      {
        id: 'comments',
        label: 'Комментарии у блоков команд',
        weight: 8,
        check: function (code) {
          return { pass: SqlUtil.hasBlockComments(code) };
        }
      },
      {
        id: 'update_agency',
        label: 'UPDATE AGENCY = 1000 для max CONTRACT_DATE',
        weight: 18,
        hint: 'Подзапрос с MAX(contract_date) или ROW_NUMBER / RANK.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bUPDATE\s+[\w.]*agents\b/i.test(norm) &&
            /\bagency\s*=\s*1000\b/i.test(norm) &&
            /\bcontract_date\b/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'schema_update',
        label: 'Схема в UPDATE agents',
        weight: 8,
        check: function (code) {
          var stmts = SqlUtil.splitStatements(code);
          var hit = stmts.some(function (s) {
            return /\bagency\s*=\s*1000\b/i.test(s) &&
              /\bUPDATE\s+\w+\.\w+\s+\w+\s+SET\b/i.test(SqlUtil.normalize(s));
          });
          return { pass: hit };
        }
      },
      {
        id: 'create_and_deletes',
        label: 'CREATE таблицы + DELETE все / половина / 10%',
        weight: 16,
        hint: 'DELETE без WHERE; DELETE WHERE ROWNUM <= 50%; DELETE WHERE ROWNUM <= 10%.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var hasCreate = /\bCREATE\s+TABLE\s+\w+\.\w+/i.test(norm);
          var deletes = SqlUtil.countMatches(code, /\bDELETE\s+FROM\b/gi);
          var hasHalf = /50\s*%|\/\s*2|половин|half/i.test(code);
          var hasTenth = /10\s*%|десят/i.test(code);
          var ok = hasCreate && deletes >= 3 && hasHalf && hasTenth;
          return { pass: ok, detail: 'CREATE: ' + hasCreate + ', DELETE×' + deletes };
        }
      },
      {
        id: 'delete_agents_match',
        label: 'DELETE agents WHERE agent = edu.partners.partner',
        weight: 14,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bDELETE\s+FROM\s+[\w.]*agents\b/i.test(norm) &&
            /\bedu\.partners\b/i.test(code) &&
            /\bagent\b/i.test(norm) && /\bpartner\b/i.test(norm);
          return { pass: ok };
        }
      },
      {
        id: 'aliases',
        label: 'Алиасы таблиц в UPDATE/DELETE',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var upd = /\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./i.test(norm);
          var delM = norm.match(/\bDELETE\s+FROM\s+[\w.]+\s+(\w+)\b/i);
          var del = delM && new RegExp('\\b' + delM[1] + '\\.').test(norm);
          return { pass: upd && del, detail: 'UPDATE alias: ' + upd + ', DELETE alias: ' + del };
        }
      },
      {
        id: 'delete_fork_comment',
        label: 'Комментарий к способу удаления половины / 10%',
        weight: 6,
        check: function (code) {
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bDELETE\s+FROM\b/i.test(s);
          }, /50|10|половин|десят|rownum|percent|%/i);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий к DELETE' };
        }
      }
    ],
    checklist: [
      { label: 'Комментарии', ids: ['comments', 'delete_fork_comment'] },
      { label: 'Схема', ids: ['schema_update'] },
      { label: 'UPDATE agency', ids: ['update_agency'] },
      { label: 'DELETE варианты', ids: ['create_and_deletes'] },
      { label: 'DELETE agents', ids: ['delete_agents_match'] },
      { label: 'Алиасы', ids: ['aliases'] }
    ]
  },
  {
    id: 'task5_partners_gaps',
    title: 'Задание 5 — Копия partners и нумерация',
    passScore: 75,
    html: '<p><b>Инструкция.</b> Если в решении есть развилка — поясните её в комментарии в SQL-коде.</p>' +
      '<ol style="margin:8px 0;padding-left:20px;line-height:1.55">' +
      '<li>Скопируйте таблицу партнёров <b>с данными</b> (CREATE TABLE … AS SELECT * FROM edu.partners).</li>' +
      '<li>Проверьте актуальность телефонов. Если данные устарели — добавьте столбец <b>sUsedEmergencyCommunicationType</b> (VARCHAR2 30) и обновите: «Phone» при наличии телефона, «Mail» — если нет.</li>' +
      '<li>Удалите всю таблицу <b>без возможности восстановления</b> (DROP … PURGE).</li>' +
      '<li>Добавьте в копию <b>agents</b> пять записей одним оператором (INSERT ALL).</li>' +
      '<li>UPDATE partner в копии partners: убрать «дыры» в нумерации (1,2,5,6,9 → 1,2,3,4,5). Для всех записей или для 25 — с комментарием.</li>' +
      '</ol>' +
      '<p style="margin-top:10px;font-size:.88rem;color:#94a3b8">Критерии: работоспособность · комментарии · схема перед таблицами · алиасы.</p>',
    rubric: [
      {
        id: 'comments',
        label: 'Комментарии у блоков команд',
        weight: 8,
        check: function (code) {
          return { pass: SqlUtil.hasBlockComments(code) };
        }
      },
      {
        id: 'schema_create',
        label: 'Схема перед своими таблицами',
        weight: 8,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bCREATE\s+TABLE\s+\w+\.\w+/i.test(norm) &&
            (/\bDROP\s+TABLE\s+\w+\.\w+/i.test(norm) || /\bDROP\s+TABLE\s+\w+\.\w+\s+PURGE/i.test(norm));
          return { pass: ok };
        }
      },
      {
        id: 'ctas_partners_full',
        label: 'CREATE TABLE partners AS SELECT * FROM edu.partners',
        weight: 12,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          return { pass: /\bCREATE\s+TABLE\s+[\w.]*partners\s+AS\b/i.test(norm) &&
            /\bedu\.partners\b/i.test(code) &&
            /\bSELECT\b[\s\S]*\bFROM\b/i.test(norm) };
        }
      },
      {
        id: 'add_emergency_col',
        label: 'ALTER ADD sUsedEmergencyCommunicationType VARCHAR2(30)',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          return { pass: /\bALTER\s+TABLE\s+[\w.]*partners\s+ADD\b[\s\S]*\bsUsedEmergencyCommunicationType\b/i.test(norm) &&
            /\bvarchar2\s*\(\s*30\s*\)/i.test(norm) };
        }
      },
      {
        id: 'update_phone_mail',
        label: 'UPDATE Phone / Mail по наличию телефона',
        weight: 12,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bUPDATE\s+[\w.]*partners\b/i.test(norm) &&
            /\bPhone\b/i.test(code) && /\bMail\b/i.test(code) &&
            (/\bphone\b/i.test(norm) || /\btel\b/i.test(norm) || /\bmobile\b/i.test(norm));
          return { pass: ok };
        }
      },
      {
        id: 'drop_purge',
        label: 'DROP TABLE … PURGE (без восстановления)',
        weight: 10,
        check: function (code) {
          return { pass: /\bDROP\s+TABLE\s+[\w.]+\s+PURGE\b/i.test(SqlUtil.normalize(code)) };
        }
      },
      {
        id: 'insert_all_agents',
        label: 'INSERT ALL — 5 записей в agents',
        weight: 10,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bINSERT\s+ALL\b/i.test(norm) &&
            /\bINTO\s+[\w.]*agents\b/i.test(norm) &&
            SqlUtil.countMatches(code, /\bINTO\s+[\w.]*agents\b/gi) >= 5;
          return { pass: ok };
        }
      },
      {
        id: 'update_partner_gaps',
        label: 'UPDATE partner — убрать пропуски в нумерации',
        weight: 14,
        hint: 'ROW_NUMBER(), DENSE_RANK() или MERGE — с комментарием.',
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var ok = /\bUPDATE\s+[\w.]*partners\b/i.test(norm) &&
            /\bpartner\b/i.test(norm) &&
            (/\brow_number\b/i.test(norm) || /\bdense_rank\b/i.test(norm) ||
              /\brank\b/i.test(norm) || /\bmerge\b/i.test(norm) ||
              /\brownum\b/i.test(norm));
          return { pass: ok };
        }
      },
      {
        id: 'gaps_comment',
        label: 'Комментарий к перенумерации partner',
        weight: 4,
        check: function (code) {
          var ok = SqlUtil.adjacentCommentMatch(code, function (s) {
            return /\bUPDATE\b/i.test(s) && /\bpartner\b/i.test(s);
          }, /25|дыр|пропуск|gap|row_number|dense_rank|нумерац|перенумер/);
          return { pass: ok, detail: ok ? 'Пояснение найдено' : 'Добавьте комментарий к UPDATE partner' };
        }
      },
      {
        id: 'aliases',
        label: 'Алиасы таблиц в UPDATE/SELECT',
        weight: 6,
        check: function (code) {
          var norm = SqlUtil.normalize(code);
          var upd = /\bUPDATE\s+[\w.]+\s+(\w+)\s+SET\s+\1\./i.test(norm);
          var selM = norm.match(/\bFROM\s+[\w.]+\s+(\w+)\b/i);
          var sel = selM && new RegExp('\\b' + selM[1] + '\\.').test(norm);
          return { pass: upd || sel, detail: 'UPDATE alias: ' + upd + ', SELECT alias: ' + sel };
        }
      }
    ],
    checklist: [
      { label: 'Комментарии', ids: ['comments', 'gaps_comment'] },
      { label: 'Схема', ids: ['schema_create'] },
      { label: 'Копия partners', ids: ['ctas_partners_full', 'add_emergency_col', 'update_phone_mail'] },
      { label: 'DROP PURGE', ids: ['drop_purge'] },
      { label: 'INSERT ALL agents', ids: ['insert_all_agents'] },
      { label: 'Перенумерация partner', ids: ['update_partner_gaps'] },
      { label: 'Алиасы', ids: ['aliases'] }
    ]
  }
];
