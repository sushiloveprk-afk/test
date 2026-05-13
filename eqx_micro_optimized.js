// Micro-optimized helpers extracted from EQX widget code.
// Safe drop-in: behavior is unchanged, only duplicated logic is unified.

function runEqxSearch($input, goById, goByName, setErr) {
  const v = String($input.val() || '').trim();
  if (!v) {
    setErr($input);
    return false;
  }

  const isNumeric = /^\d+$/.test(v);
  let ok = false;
  if (isNumeric) ok = goById(v);
  if (!ok) ok = goByName(v);

  if (!ok) setErr($input);
  else $input.val('');

  return ok;
}

function bindEqxSearchHandlers($input, goById, goByName, setErr) {
  const run = () => runEqxSearch($input, goById, goByName, setErr);

  $(document)
    .off('keydown.eqx', '#eqxQuery')
    .on('keydown.eqx', '#eqxQuery', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });

  return run;
}
