'use strict';

const fs = require('fs');
const gulp = require('gulp');
const eslint = require('gulp-eslint');
const path = require('path');
const shell = require('gulp-shell');
const yaml = require('js-yaml');

gulp.task('lint', () =>
  gulp.src([
    '**/*.js',
    '!node_modules/**'
  ]).pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError()));

gulp.task('validate:schemas', cb => {
  const schemasPath = path.join(__dirname, 'schemas');
  const schemas = fs.readdirSync(schemasPath);
  const errors = [];

  schemas.forEach(schema => {
    const schemaPath = path.join(schemasPath, schema);
    try {
      yaml.safeLoad(fs.readFileSync(schemaPath), {
        filename: path.relative(__dirname, schemaPath)
      });
    } catch (error) {
      errors.push(error);
    }
  });

  return errors.length === 0 ? cb() : cb(errors);
});

gulp.task('test', shell.task([
  'nyc mocha --timeout 5000'
]));

gulp.task('default', gulp.series(
  gulp.parallel(
    'lint',
    'validate:schemas'),
  'test')
);
