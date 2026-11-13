# Regression tests from the adversarial review of 5.0

These tests come from three independent reviews that tried to break the library before the 5.0 release:
virtualization and changing data, memoization and React correctness, compatibility with an application
running 4.x. Each file reproduces a defect that was found and fixed, or an attack that held.

- A test that reproduces a defect states it at the top of its file. Most of them were also run on 4.0.2,
  to tell a regression from a defect the library already had.
- `runtime-prop-changes`, `interaction-order` and `random-sequences` compare a table after a change with a
  table mounted from scratch with the same props: they take the most time and catch the widest range of
  stale displays.
- `harness.tsx` and `scenario.js` are shared helpers, not tests.
