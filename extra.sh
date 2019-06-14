
node source/build-worker.js

cp icon.* build
cp source/script/workerSlicer.class.js build/desk-ui
cp source/script/workerSlicer.worker.js build/desk-ui
cp source/script/workerSlicer.class.js source-output/desk-ui
cp source/script/workerSlicer.worker.js source-output/desk-ui
cp splash.png build
cp splash.html build
cp icone_eduanat2.png build
cp script.js build
cp package.json build
cp -r source/resource/ife source-output/resource/ife

cp source/script/test.js build/desk-ui
cp source/script/test.js source-output/desk-ui
cp -r source/resource/ build

cd build
npm install --production
cd ..
