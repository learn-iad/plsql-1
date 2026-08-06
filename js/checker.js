/* eslint-disable no-unused-vars */
var Checker = (function () {
  function run(code, task) {
    var ctx = { schema: SqlUtil.detectSchema(code) || 'student_schema' };
    var criteria = [];
    var totalWeight = 0;
    var earned = 0;

    task.rubric.forEach(function (item) {
      totalWeight += item.weight;
      var result = item.check(code, ctx);
      if (result.pass) earned += item.weight;
      criteria.push({
        id: item.id,
        label: item.label,
        weight: item.weight,
        pass: result.pass,
        detail: result.detail || '',
        hint: result.hint || item.hint || ''
      });
    });

    var score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
    var failed = criteria.filter(function (c) { return !c.pass; });
    var passed = criteria.filter(function (c) { return c.pass; });

    var oracleCtx = { missingSchema: [] };
    criteria.forEach(function (c) {
      if (c.id === 'schema_second_update' && !c.pass) oracleCtx.missingSchema.push('UPDATE … idsupervisor = 2000');
      if (c.id === 'schema_create_agent' && !c.pass) oracleCtx.missingSchema.push('CREATE TABLE Agent');
    });

    return {
      score: score,
      criteria: criteria,
      strengths: passed.map(function (c) { return c.label; }),
      weaknesses: failed.map(function (c) { return c.label; }),
      oracleErrors: OracleErrors.detect(code, oracleCtx),
      pass: score >= task.passScore
    };
  }

  return { run: run };
})();
