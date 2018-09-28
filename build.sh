rm -rf EduAnat2-*
cp source/script/workerSlicer.class.js build/script/workerSlicer.class.js
cp source/script/workerSlicer.worker.min.js build/script/workerSlicer.worker.min.js
cp source/script/workerSlicer.worker.js build/script/workerSlicer.worker.js
cp source/script/test.js build/script/test.js
cp source/script/bundle.js build/script/bundle.js
cp source/script/STLLoader.js build/script/STLLoader.js
cp -r source/resource/ build
python generate.py build
electron-packager --overwrite --icon=icone_eduanat2.ico --azar=true --version=0.1.0 --app-version=0.1.0 --all build/ EduAnat2
for i in ./EduAnat2-*; do zip -rqy9 "${i%/}.zip" "$i"; done
