# Exercise media

Two frames per system exercise (`<slug>/0.jpg` start position, `<slug>/1.jpg` end position), 600×400 px, JPEG q62.

Source: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, The Unlicense). `mapping.json` maps each Pondus slug to the source exercise id; a few slugs use the closest available movement (e.g. `pendulum-squat` → `Hack_Squat`) and four have no match (`bird-dog`, `hollow-hold`, `burpee`, `ninety-ninety-hip-switch`) and fall back to a placeholder.

`src/assets/exercise-media.ts` is the generated static `require()` map used by `ExerciseAnimation` / `ExerciseThumbnail`.
