/* eslint-disable no-unused-vars */
var OracleErrors = (function () {
  var CATALOG = {
    ORA_00942: {
      code: 'ORA-00942',
      title: 'table or view does not exist',
      explain: 'Oracle не нашла указанную таблицу или представление. Проверьте имя, схему (schema.table) и что объект создан в текущей сессии до обращения к нему.'
    },
    ORA_00904: {
      code: 'ORA-00904',
      title: 'invalid identifier',
      explain: 'Использовано имя столбца или псевдонима, которого нет в контексте запроса. Частая причина — опечатка или отсутствие алиаса таблицы (ag.column).'
    },
    ORA_00933: {
      code: 'ORA-00933',
      title: 'SQL command not properly ended',
      explain: 'Синтаксическая ошибка: лишняя запятая, неверный порядок ключевых слов или пропущена точка с запятой между командами.'
    },
    DELETE_INSTEAD_OF_DROP: {
      code: 'ORA-00900',
      title: 'invalid SQL statement (эмуляция)',
      explain: 'DELETE FROM удаляет **строки**, а не таблицу. Для удаления объекта нужен DROP TABLE. Таблицу можно восстановить из корзины (recycle bin), если не указан PURGE. В следующих задачах встретится DROP … PURGE — без возможности восстановления.'
    },
    NO_ALIAS_UPDATE: {
      code: 'PLS-00323',
      title: 'subprogram or cursor reference (эмуляция)',
      explain: 'В UPDATE/SELECT рекомендуется указывать алиас таблицы (UPDATE agents ag SET ag.col = …). Так код читается проще и снижается риск неоднозначности столбцов.'
    },
    MISSING_SCHEMA: {
      code: 'ORA-00942',
      title: 'table or view does not exist (эмуляция)',
      explain: 'Перед именем таблицы должна быть указана схема (например student_schema.AGENTS), особенно в командах, которые вы пишете сами, а не копируете дословно из условия.'
    },
    NO_COMMIT_HINT: {
      code: 'INFO',
      title: 'COMMIT не выполнен',
      explain: 'После INSERT/UPDATE в PL/SQL Developer изменения видны только в вашей сессии до COMMIT. В задании напоминают нажать зелёную кнопку COMMIT — в решении можно добавить COMMIT; или пояснить в комментарии, что фиксация выполняется вручную.'
    }
  };

  function detect(code, ctx) {
    var found = [];
    var sql = code || '';
    var norm = SqlUtil.normalize(sql);

    if (/\bDELETE\s+FROM\s+\w*\.?\s*Agent\b/i.test(norm)) {
      found.push(CATALOG.DELETE_INSTEAD_OF_DROP);
    }

    if (/\bUPDATE\s+(?!(\w+\.\w+\s+\w+|(\w+)\s+\2\b))\w+\s+SET/i.test(norm)) {
      found.push(CATALOG.NO_ALIAS_UPDATE);
    }

    if (ctx && ctx.missingSchema) {
      found.push(Object.assign({}, CATALOG.MISSING_SCHEMA, {
        detail: 'Ожидалась схема'
      }));
    }

    if (/\bINSERT\s+INTO\b/i.test(norm) && !/\bCOMMIT\b/i.test(norm)) {
      found.push(CATALOG.NO_COMMIT_HINT);
    }

    return found;
  }

  return { CATALOG: CATALOG, detect: detect };
})();
