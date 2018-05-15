const gulp = require('gulp');
const ts = require('gulp-typescript');

const pkg = ts.createProject('./tsconfig.json');
const moduleName = 'kue';
const source = 'src';
const dist = 'dist';

gulp.task('default', function () {
    gulp.watch([`./${source}/**/*.ts`, `${source}/*.ts`, `./package.json`], [moduleName, 'copy']);
});

gulp.task(moduleName, () => {
    return pkg.src()
        .pipe(pkg())
        .pipe(gulp.dest(`${dist}`));
});

gulp.task('copy', () => {
    return gulp.src(['./package.json', './README.md'])
        .pipe(gulp.dest(`${dist}`));
});
