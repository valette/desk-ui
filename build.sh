rm -rf ife-desk-*
cp source/script/workerSlicer.class.js build/script/workerSlicer.class.js
cp source/script/workerSlicer.worker.min.js build/script/workerSlicer.worker.min.js
cp source/script/workerSlicer.worker.js build/script/workerSlicer.worker.js
cp source/script/test.js build/script/test.js
cp source/script/bundle.js build/script/bundle.js
cp source/script/STLLoader.js build/script/STLLoader.js
cp -r source/resource/ build
python generate.py build
electron-packager --overwrite --all build/
for i in ./ife-desk-*; do zip -rq "${i%/}.zip" "$i"; done
