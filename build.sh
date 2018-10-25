rm -rf EduAnat2-*
cp source/script/workerSlicer.class.js build/script/workerSlicer.class.js
cp source/script/workerSlicer.worker.min.js build/script/workerSlicer.worker.min.js
cp source/script/workerSlicer.worker.js build/script/workerSlicer.worker.js
cp source/script/test.js build/script/test.js
cp source/script/bundle.js build/script/bundle.js
cp source/script/STLLoader.js build/script/STLLoader.js
cp -r source/resource/ build
python generate.py build
electron-packager --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch ia32 --platform win32 build/ EduAnat2
electron-packager --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch ia32 --platform linux build/ EduAnat2
electron-packager --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch x64 --platform linux build/ EduAnat2
electron-packager --overwrite --icon=icon.ico --azar=true --app-version=2.0.0 --arch x64 --platform darwin build/ EduAnat2
for i in ./EduAnat2-*; do zip -rqy "dist/${i%/}.zip" "$i"; done
electron-builder build -wl --config builder-effective-config.yaml
